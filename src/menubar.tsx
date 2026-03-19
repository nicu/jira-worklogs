import { Color, Icon, LaunchType, MenuBarExtra, launchCommand } from "@raycast/api";
import { getLocalDay } from "./db/timers";
import { useStartTimer } from "./hooks/useStartTimer";
import { useStopTimer } from "./hooks/useStopTimer";
import { useWorklogs } from "./hooks/useWorklogs";
import { getMenubarTextMaxLength } from "./preferences";
import { buildIssueLabel, truncateText } from "./utils/text";
import { formatDuration } from "./utils/time";

async function openCommand(name: "select-issue" | "worklogs") {
  await launchCommand({ name, type: LaunchType.UserInitiated });
}

function getWorklogIcon(isActive: boolean, isSynced: boolean) {
  if (isActive) {
    return { source: Icon.CircleFilled, tintColor: Color.Red };
  }

  if (isSynced) {
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  }

  return Icon.Clock;
}

export default function Command() {
  const today = getLocalDay();
  const { activeTimer, worklogs, isLoading, isSyncingRemote, error, reload, refresh } = useWorklogs(today, {
    broadcastRemoteChanges: false,
    syncRemoteOnMount: false,
    subscribeToEvents: false,
  });
  const activeIssueKey = activeTimer?.issue_key ?? activeTimer?.task_id;
  const activeLabel = activeTimer ? buildIssueLabel(activeIssueKey, activeTimer.issue_summary) : undefined;
  const maxTitleLength = getMenubarTextMaxLength();
  const menuIcon = activeTimer
    ? { source: Icon.CircleFilled, tintColor: Color.Red }
    : { source: Icon.Clock, tintColor: Color.SecondaryText };
  const title = activeLabel ? truncateText(activeLabel, maxTitleLength) : undefined;
  const startTimer = useStartTimer(reload);
  const stopTimer = useStopTimer(reload);

  function renderWorklogItem(worklog: (typeof worklogs)[number]) {
    const isActive = activeTimer?.task_id === worklog.task_id;
    const elapsed = isActive ? Math.floor((Date.now() - new Date(activeTimer.started_at_utc).getTime()) / 1000) : 0;
    const totalSeconds = worklog.total_duration_seconds + elapsed;
    const fullLabel = buildIssueLabel(worklog.issue_key ?? worklog.task_id, worklog.issue_summary);
    const isSynced = worklog.is_synced === 1 && !isActive;

    return (
      <MenuBarExtra.Item
        key={worklog.task_id}
        title={truncateText(fullLabel, maxTitleLength)}
        subtitle={totalSeconds > 0 ? formatDuration(totalSeconds) : "No logged time"}
        tooltip={fullLabel}
        icon={getWorklogIcon(isActive, isSynced)}
        onAction={() =>
          isActive
            ? stopTimer(worklog.issue_key ?? worklog.task_id)
            : startTimer(
                worklog.task_id,
                worklog.issue_key ?? worklog.task_id,
                worklog.issue_summary ?? "",
                worklog.issuetype_icon_url ?? undefined,
              )
        }
      />
    );
  }

  return (
    <MenuBarExtra
      icon={menuIcon}
      title={title}
      tooltip={activeLabel ? `${activeLabel} running` : "Jira Worklogs"}
      isLoading={isLoading || isSyncingRemote}
    >
      {worklogs.length > 0 ? (
        <MenuBarExtra.Section title="Today">{worklogs.map(renderWorklogItem)}</MenuBarExtra.Section>
      ) : (
        <MenuBarExtra.Section title="Today">
          <MenuBarExtra.Item title="No Worklogs Yet" subtitle="Today has no worklogs" icon={Icon.Clock} />
        </MenuBarExtra.Section>
      )}
      <MenuBarExtra.Section title="Actions">
        <MenuBarExtra.Item title="Open Worklogs" icon={Icon.List} onAction={() => openCommand("worklogs")} />
        <MenuBarExtra.Item
          title="Select Issue"
          icon={Icon.MagnifyingGlass}
          onAction={() => openCommand("select-issue")}
        />
        <MenuBarExtra.Item
          title={isSyncingRemote ? "Refreshing from Jira..." : "Refresh from Jira"}
          icon={Icon.ArrowClockwise}
          onAction={refresh}
        />
      </MenuBarExtra.Section>
      {error ? (
        <MenuBarExtra.Section title="Status">
          <MenuBarExtra.Item title="Refresh Failed" subtitle={error.message} icon={Icon.ExclamationMark} />
        </MenuBarExtra.Section>
      ) : null}
    </MenuBarExtra>
  );
}
