export function createSync<T>(
  loadFromDb: () => Promise<T>,
  fetchFromRemote: () => Promise<T>,
  saveToDb: (data: T) => Promise<void>,
  getLastFetch: () => Promise<Date | null>,
  ttl: number,
) {
  return async function sync(forceRefresh = false, onCachedData?: (data: T) => void): Promise<T> {
    // Step 1 — serve from DB immediately for instant render
    const cachedData = await loadFromDb();
    onCachedData?.(cachedData);

    // Step 2 — skip network if cache is still fresh (unless caller forces refresh)
    if (!forceRefresh) {
      try {
        const lastFetch = await getLastFetch();
        const isFresh = lastFetch != null && Date.now() - lastFetch.getTime() < ttl;
        if (isFresh) return cachedData;
      } catch {
        // ignore metadata read errors and fall through to network fetch
      }
    }

    // Step 3 — fetch from remote, persist, and return fresh data
    const freshData = await fetchFromRemote();
    await saveToDb(freshData);
    return freshData;
  };
}
