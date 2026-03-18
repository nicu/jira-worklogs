import { useEffect, useState } from "react";
import { getActiveTimer, getLocalDay, getTodayTimers, type TimerRow } from "../db/timers";

export function useTodayWorklogs() {
  const [activeTimer, setActiveTimer] = useState<TimerRow | null>(null);
  const [todayTimers, setTodayTimers] = useState<TimerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const today = getLocalDay();
        const [active, timers] = await Promise.all([getActiveTimer(), getTodayTimers(today)]);
        if (!cancelled) {
          setActiveTimer(active);
          setTodayTimers(timers);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { activeTimer, todayTimers, isLoading, error, refresh };
}
