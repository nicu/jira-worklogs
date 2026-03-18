import { closeMainWindow, showToast, Toast } from "@raycast/api";
import { startTimer } from "../db/timers";
import { publishEvent, WORKLOGS_CHANGED_EVENT } from "../services/eventBus";

/**
 * Returns an async callback that starts a timer for an issue.
 * @param onSuccess - Called after the timer is successfully started.
 *   Defaults to closing the Raycast window. Pass a `refresh` function
 *   to stay in the view and re-render instead.
 */
export function useStartTimer(onSuccess?: () => void | Promise<void>) {
  return async function handleStartTimer(
    issueId: string,
    issueKey: string,
    issueSummary: string,
    issuetypeIconUrl?: string,
  ): Promise<void> {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Starting timer…", message: issueKey });
    try {
      await startTimer(issueId, {
        issueKey,
        issueSummary,
        issuetypeIconUrl,
      });
      await publishEvent(WORKLOGS_CHANGED_EVENT, ["menubar"]);
      toast.style = Toast.Style.Success;
      toast.title = "Timer started";
      toast.message = `${issueKey} · ${issueSummary}`;
      if (onSuccess) {
        await onSuccess();
      } else {
        await closeMainWindow();
      }
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to start timer";
      toast.message = String(err);
    }
  };
}
