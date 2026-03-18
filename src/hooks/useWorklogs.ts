import { useEffect, useState } from "react";
import { getActiveTimer, getWorklogsForDay, type TimerRow, type WorklogRow } from "../db/timers";
import { publishEvent, useEventSubscription, WORKLOGS_CHANGED_EVENT } from "../services/eventBus";
import { syncRemoteWorklogsForDay } from "../services/worklogs";

type UseWorklogsOptions = {
  broadcastRemoteChanges?: boolean;
  syncRemoteOnMount?: boolean;
  subscribeToEvents?: boolean;
};

const ignoreEvent = () => {};

export function useWorklogs(localDay: string, options?: UseWorklogsOptions) {
  const [activeTimer, setActiveTimer] = useState<TimerRow | null>(null);
  const [worklogs, setWorklogs] = useState<WorklogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingRemote, setIsSyncingRemote] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [request, setRequest] = useState({ key: 0, forceRemoteRefresh: false });
  const broadcastRemoteChanges = options?.broadcastRemoteChanges ?? true;
  const syncRemoteOnMount = options?.syncRemoteOnMount ?? true;
  const subscribeToEvents = options?.subscribeToEvents ?? true;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      try {
        const [active, cachedWorklogs] = await Promise.all([getActiveTimer(), getWorklogsForDay(localDay)]);
        if (!cancelled) {
          setActiveTimer(active);
          setWorklogs(cachedWorklogs);
          setError(undefined);
        }

        const shouldSyncRemote = request.forceRemoteRefresh || syncRemoteOnMount;
        if (!shouldSyncRemote) {
          return;
        }

        if (!cancelled) {
          setIsLoading(false);
          setIsSyncingRemote(true);
        }

        const didSyncRemote = await syncRemoteWorklogsForDay(localDay, request.forceRemoteRefresh);
        if (didSyncRemote) {
          const [nextActive, syncedWorklogs] = await Promise.all([getActiveTimer(), getWorklogsForDay(localDay)]);
          if (!cancelled) {
            setActiveTimer(nextActive);
            setWorklogs(syncedWorklogs);
          }
          if (broadcastRemoteChanges) {
            await publishEvent(WORKLOGS_CHANGED_EVENT, ["menubar"]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsSyncingRemote(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [broadcastRemoteChanges, localDay, request.forceRemoteRefresh, request.key, syncRemoteOnMount]);

  const reload = () => setRequest((state) => ({ key: state.key + 1, forceRemoteRefresh: false }));
  const refresh = () => setRequest((state) => ({ key: state.key + 1, forceRemoteRefresh: true }));

  useEventSubscription(WORKLOGS_CHANGED_EVENT, subscribeToEvents ? reload : ignoreEvent);

  return { activeTimer, worklogs, isLoading, isSyncingRemote, error, reload, refresh };
}
