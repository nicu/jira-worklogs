import { jiraOAuth, jiraPkceClient } from "./oauth";
import type {
  JiraAccessibleResource,
  JiraCurrentUser,
  JiraPageOfWorklogs,
  JiraSearchResponse,
  JiraWorklog,
} from "./types";

const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";
const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
const DEFAULT_FIELDS = "summary,status,priority,project,issuetype,assignee,updated,created";
let sitePromise: Promise<JiraAccessibleResource> | undefined;

function formatJiraError(status: number, statusText: string, body: string): string {
  const rawBody = body.trim();

  if (!rawBody) {
    return `Jira API error ${status} (${statusText})`;
  }

  try {
    const parsed = JSON.parse(rawBody) as {
      errorMessages?: unknown;
      errors?: Record<string, unknown>;
      message?: unknown;
    };
    const parts: string[] = [];

    if (Array.isArray(parsed.errorMessages)) {
      parts.push(...parsed.errorMessages.filter((message): message is string => typeof message === "string" && message.length > 0));
    }

    if (parsed.errors && typeof parsed.errors === "object") {
      for (const [field, message] of Object.entries(parsed.errors)) {
        if (typeof message === "string" && message.length > 0) {
          parts.push(field === "worklog" ? message : `${field}: ${message}`);
        }
      }
    }

    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      parts.push(parsed.message);
    }

    const details = Array.from(new Set(parts)).join(" · ");
    return details.length > 0 ? `Jira API error ${status} (${statusText}): ${details}` : `Jira API error ${status} (${statusText}): ${rawBody}`;
  } catch {
    return `Jira API error ${status} (${statusText}): ${rawBody}`;
  }
}

async function jiraFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatJiraError(response.status, response.statusText, body));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();
  if (!body) {
    return undefined as T;
  }

  return JSON.parse(body) as T;
}

export async function getAccessibleResources(token: string): Promise<JiraAccessibleResource[]> {
  return jiraFetch<JiraAccessibleResource[]>(ACCESSIBLE_RESOURCES_URL, token);
}

async function ensureAuthorizedToken(): Promise<string> {
  const storedTokens = await jiraPkceClient.getTokens();

  if (!storedTokens) {
    sitePromise = undefined;
  }

  return authorize();
}

async function authorize(): Promise<string> {
  try {
    return await jiraOAuth.authorize();
  } catch {
    await jiraPkceClient.removeTokens();
    sitePromise = undefined;
    return jiraOAuth.authorize();
  }
}

async function getSite(token: string): Promise<JiraAccessibleResource> {
  if (!sitePromise) {
    sitePromise = (async () => {
      const [site] = await getAccessibleResources(token);
      if (!site) {
        throw new Error("No Jira site was available for this account.");
      }
      return site;
    })().catch((error) => {
      sitePromise = undefined;
      throw error;
    });
  }

  return sitePromise;
}

async function jiraApiFetch<T>(
  path: string,
  searchParams?: Record<string, string | number | boolean | undefined>,
  init?: RequestInit,
): Promise<T> {
  const token = await ensureAuthorizedToken();
  const site = await getSite(token);
  const url = new URL(`${JIRA_API_BASE}/${site.id}/rest/api/3/${path}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }

  return jiraFetch<T>(url.toString(), token, init);
}

export async function fetchIssues(
  jql: string,
  options: {
    maxResults?: number;
    nextPageToken?: string;
  } = {},
): Promise<JiraSearchResponse> {
  return jiraApiFetch<JiraSearchResponse>("search/jql", undefined, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      fields: DEFAULT_FIELDS.split(","),
      fieldsByKeys: false,
      maxResults: options.maxResults ?? 50,
      nextPageToken: options.nextPageToken,
    }),
  });
}

export async function getCurrentUser(): Promise<JiraCurrentUser> {
  return jiraApiFetch<JiraCurrentUser>("myself");
}

export async function fetchIssueWorklogs(
  issueIdOrKey: string,
  options: {
    startAt?: number;
    maxResults?: number;
    startedAfter?: number;
    startedBefore?: number;
  } = {},
): Promise<JiraPageOfWorklogs> {
  return jiraApiFetch<JiraPageOfWorklogs>(`issue/${issueIdOrKey}/worklog`, {
    startAt: options.startAt,
    maxResults: options.maxResults,
    startedAfter: options.startedAfter,
    startedBefore: options.startedBefore,
  });
}

export async function getIssueBrowseUrl(issueKey: string): Promise<string> {
  const token = await ensureAuthorizedToken();
  const site = await getSite(token);
  return `${site.url.replace(/\/$/, "")}/browse/${encodeURIComponent(issueKey)}`;
}

export async function createIssueWorklog(
  issueIdOrKey: string,
  body: {
    started: string;
    timeSpentSeconds: number;
    comment?: unknown;
  },
): Promise<JiraWorklog> {
  return jiraApiFetch<JiraWorklog>(
    `issue/${issueIdOrKey}/worklog`,
    {
      notifyUsers: false,
      adjustEstimate: "leave",
    },
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
