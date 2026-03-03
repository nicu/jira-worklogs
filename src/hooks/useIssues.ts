import { Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchIssues } from "../jira/jira.service";
import type { JiraIssue } from "../jira/types";

const ASSIGNED_JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
const WATCHED_JQL =
  "watcher = currentUser() AND assignee != currentUser() AND statusCategory != Done ORDER BY updated DESC";

const CACHE_KEY_ASSIGNED = "issues:assigned";
const CACHE_KEY_WATCHED = "issues:watched";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { issues: JiraIssue[]; fetchedAt: number };

const cache = new Cache();

function readCache(key: string): CacheEntry | undefined {
  const raw = cache.get(key);
  return raw ? (JSON.parse(raw) as CacheEntry) : undefined;
}

function writeCache(key: string, issues: JiraIssue[]) {
  cache.set(key, JSON.stringify({ issues, fetchedAt: Date.now() }));
}

function isStale(entry: CacheEntry) {
  return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

export function useIssues() {
  const [assigned, setAssigned] = useState<JiraIssue[]>(() => readCache(CACHE_KEY_ASSIGNED)?.issues ?? []);
  const [watched, setWatched] = useState<JiraIssue[]>(() => readCache(CACHE_KEY_WATCHED)?.issues ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const forceRefresh = refreshKey > 0;
    const cachedAssigned = readCache(CACHE_KEY_ASSIGNED);
    const cachedWatched = readCache(CACHE_KEY_WATCHED);

    if (!forceRefresh && cachedAssigned && !isStale(cachedAssigned) && cachedWatched && !isStale(cachedWatched)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all([fetchIssues(ASSIGNED_JQL), fetchIssues(WATCHED_JQL)])
      .then(([assignedRes, watchedRes]) => {
        setAssigned(assignedRes.issues);
        setWatched(watchedRes.issues);
        writeCache(CACHE_KEY_ASSIGNED, assignedRes.issues);
        writeCache(CACHE_KEY_WATCHED, watchedRes.issues);
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setIsLoading(false));
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { assigned, watched, isLoading, error, refresh };
}
