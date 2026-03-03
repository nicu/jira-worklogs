import { jiraOAuth, jiraPkceClient } from "./oauth";
import type { JiraAccessibleResource, JiraSearchResponse } from "./types";

const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";
const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
const DEFAULT_FIELDS = "summary,status,priority,project,issuetype,assignee,updated,created";

async function jiraFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API error ${response.status} (${response.statusText}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function getAccessibleResources(token: string): Promise<JiraAccessibleResource[]> {
  return jiraFetch<JiraAccessibleResource[]>(ACCESSIBLE_RESOURCES_URL, token);
}

async function authorize(): Promise<string> {
  try {
    return await jiraOAuth.authorize();
  } catch {
    await jiraPkceClient.removeTokens();
    return jiraOAuth.authorize();
  }
}

export async function fetchIssues(jql: string, maxResults = 50, startAt = 0): Promise<JiraSearchResponse> {
  const token = await authorize();
  const [site] = await getAccessibleResources(token);

  const url = new URL(`${JIRA_API_BASE}/${site.id}/rest/api/3/search/jql`);
  url.searchParams.set("jql", jql);
  url.searchParams.set("fields", DEFAULT_FIELDS);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("startAt", String(startAt));
  return jiraFetch<JiraSearchResponse>(url.toString(), token);
}
