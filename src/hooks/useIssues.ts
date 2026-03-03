import { useEffect, useState } from "react";
import { fetchIssues } from "../jira/jira.service";
import type { JiraIssue } from "../jira/types";

const ASSIGNED_JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
const WATCHED_JQL =
  "watcher = currentUser() AND assignee != currentUser() AND statusCategory != Done ORDER BY updated DESC";

export function useIssues() {
  const [assigned, setAssigned] = useState<JiraIssue[]>([]);
  const [watched, setWatched] = useState<JiraIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    Promise.all([fetchIssues(ASSIGNED_JQL), fetchIssues(WATCHED_JQL)])
      .then(([assignedRes, watchedRes]) => {
        setAssigned(assignedRes.issues);
        setWatched(watchedRes.issues);
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setIsLoading(false));
  }, []);

  return { assigned, watched, isLoading, error };
}
