import { useEffect, useState } from "react";
import type { JiraIssue } from "../jira/types";
import { syncIssues } from "../services/issues";

export function useIssues() {
  const [assigned, setAssigned] = useState<JiraIssue[]>([]);
  const [watched, setWatched] = useState<JiraIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [forceRefresh, setForceRefresh] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const { assigned, watched } = await syncIssues(
          forceRefresh,
          ({ assigned: cachedAssigned, watched: cachedWatched }) => {
            if (!cancelled) {
              setAssigned(cachedAssigned);
              setWatched(cachedWatched);
            }
          },
        );

        if (!cancelled) {
          setAssigned(assigned);
          setWatched(watched);
        }
        // reset the one-shot refresh flag after a successful sync
        if (!cancelled) setForceRefresh(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [forceRefresh]);

  const refresh = () => setForceRefresh(true);

  return { assigned, watched, isLoading, error, refresh };
}
