import { showToast, Toast } from "@raycast/api";
import { saveDayWorklogsToJira, saveIssueWorklogsToJira } from "../services/worklogs";
import { publishEvent, WORKLOGS_CHANGED_EVENT } from "../services/eventBus";

export function useSaveWorklogsToJira(onSuccess?: () => void | Promise<void>) {
  function formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/^Jira API error \d+ \([^)]+\):\s*/, "");
  }

  async function finalizeSuccess(
    result: {
      createdCount: number;
      issueCount: number;
    },
    messages: {
      emptyTitle: string;
      emptyMessage: string;
      successTitle: string;
      successMessage: (result: { createdCount: number; issueCount: number }) => string;
    },
    toast: Toast,
  ) {
    if (result.createdCount === 0) {
      toast.style = Toast.Style.Success;
      toast.title = messages.emptyTitle;
      toast.message = messages.emptyMessage;
      return;
    }

    await publishEvent(WORKLOGS_CHANGED_EVENT, ["menubar"]);
    await onSuccess?.();

    toast.style = Toast.Style.Success;
    toast.title = messages.successTitle;
    toast.message = messages.successMessage(result);
  }

  async function saveIssue(taskId: string, issueKey: string, localDay: string): Promise<void> {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Saving to Jira…",
      message: issueKey,
    });

    try {
      const result = await saveIssueWorklogsToJira(taskId, localDay);
      await finalizeSuccess(
        result,
        {
          emptyTitle: "Nothing to Save",
          emptyMessage: `${issueKey} has no unsynced local time`,
          successTitle: "Saved to Jira",
          successMessage: ({ createdCount }) => `${issueKey} · ${createdCount} worklog${createdCount === 1 ? "" : "s"}`,
        },
        toast,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to Save to Jira";
      toast.message = formatError(error);
    }
  }

  async function saveDay(localDay: string): Promise<void> {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Saving day to Jira…",
      message: localDay,
    });

    try {
      const result = await saveDayWorklogsToJira(localDay);
      await finalizeSuccess(
        result,
        {
          emptyTitle: "Nothing to Save",
          emptyMessage: `${localDay} has no unsynced local time`,
          successTitle: "Saved Day to Jira",
          successMessage: ({ createdCount, issueCount }) =>
            `${createdCount} worklog${createdCount === 1 ? "" : "s"} across ${issueCount} issue${issueCount === 1 ? "" : "s"}`,
        },
        toast,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to Save Day to Jira";
      toast.message = formatError(error);
    }
  }

  return { saveIssue, saveDay };
}
