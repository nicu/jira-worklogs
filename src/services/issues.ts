import { getStoredIssues, getLastFetch, saveIssues } from "../db/issues";
import { fetchIssues } from "../jira/jira.service";
import { createSync } from "../cache/strategy";
import type { JiraIssue } from "../jira/types";

const ASSIGNED_JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
const WATCHED_JQL =
  "watcher = currentUser() AND assignee != currentUser() AND statusCategory != Done ORDER BY updated DESC";
const REMOTE_SEARCH_MAX_RESULTS = 20;

export const ISSUES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface IssuesData {
  assigned: JiraIssue[];
  watched: JiraIssue[];
}

function sortByUpdated(issues: JiraIssue[]): JiraIssue[] {
  return issues.sort(
    (a, b) => (new Date(b.fields.updated).getTime() || 0) - (new Date(a.fields.updated).getTime() || 0),
  );
}

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Read both issue buckets from the local DB. */
export async function loadIssuesFromDb(): Promise<IssuesData> {
  const [assigned, watched] = await Promise.all([getStoredIssues("assigned"), getStoredIssues("watched")]);
  return { assigned, watched };
}

/** Fetch both issue buckets from Jira. */
export async function fetchIssuesFromJira(): Promise<IssuesData> {
  const [assigned, watched] = await Promise.all([fetchAllIssues(ASSIGNED_JQL), fetchAllIssues(WATCHED_JQL)]);
  return {
    assigned: sortByUpdated(assigned),
    watched: sortByUpdated(watched),
  };
}

async function fetchAllIssues(jql: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const page = await fetchIssues(jql, { maxResults: 50, nextPageToken });
    issues.push(...page.issues);

    if (page.isLast || !page.nextPageToken) {
      return issues;
    }

    nextPageToken = page.nextPageToken;
  }
}

export async function searchIssuesInJira(query: string): Promise<JiraIssue[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const escapedQuery = escapeJqlString(trimmedQuery);
  const jql = `(issuekey = "${escapedQuery}" OR text ~ "${escapedQuery}") ORDER BY updated DESC`;
  const page = await fetchIssues(jql, { maxResults: REMOTE_SEARCH_MAX_RESULTS });
  return sortByUpdated(page.issues);
}

/**
 * Persist both issue buckets to the DB in a single atomic write to avoid
 * clobbering the DB file mid-update.
 */
export async function saveIssuesToDb({ assigned, watched }: IssuesData): Promise<void> {
  await saveIssues(assigned, watched);
}

/**
 * Return the timestamp of the oldest successful fetch across both buckets,
 * or `null` if either bucket has never been fetched.
 */
export async function getIssuesLastFetch(): Promise<Date | null> {
  const [lastAssigned, lastWatched] = await Promise.all([getLastFetch("assigned"), getLastFetch("watched")]);
  if (!lastAssigned || !lastWatched) return null;
  return lastAssigned.getTime() < lastWatched.getTime() ? lastAssigned : lastWatched;
}

export const syncIssues = createSync<IssuesData>(
  loadIssuesFromDb,
  fetchIssuesFromJira,
  saveIssuesToDb,
  getIssuesLastFetch,
  ISSUES_CACHE_TTL_MS,
);
