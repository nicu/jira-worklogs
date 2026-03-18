import { showToast, Toast } from "@raycast/api";
import { stopActiveTimer } from "../db/timers";

export function useStopTimer(onSuccess?: () => void | Promise<void>) {
  return async function handleStopTimer(issueKey: string): Promise<void> {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Stopping timer…", message: issueKey });
    try {
      await stopActiveTimer();
      toast.style = Toast.Style.Success;
      toast.title = "Timer stopped";
      toast.message = issueKey;
      await onSuccess?.();
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to stop timer";
      toast.message = String(err);
    }
  };
}
