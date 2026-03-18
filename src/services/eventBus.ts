import { launchCommand, LaunchType, LocalStorage } from "@raycast/api";

/**
 * Publish an event by optionally launching a list of Raycast commands in the
 * background so they re-read state and refresh their UI.
 *
 * Example: `publish('timersChanged', ['menubar', 'today'])`.
 */
export async function publish(event: string, targets?: string[], payload?: any) {
  // write an event marker to LocalStorage so other processes can observe
  try {
    const key = `jira-worklogs:event:${event}`;
    const data = JSON.stringify({ ts: Date.now(), payload: payload ?? null });
    await LocalStorage.setItem(key, data);
  } catch (e) {
    // ignore storage failures
  }

  if (!targets || targets.length === 0) return;

  for (const name of targets) {
    try {
      await launchCommand({ name, type: LaunchType.Background });
    } catch (e) {
      // ignore failures for individual launches
    }
  }
}
