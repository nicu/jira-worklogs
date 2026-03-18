import { useEffect, useState } from "react";
import { Action, ActionPanel, Color, getPreferenceValues, Icon, List, showToast, Toast } from "@raycast/api";
import { useTodayWorklogs } from "./hooks/useTodayWorklogs";
import { useStartTimer } from "./hooks/useStartTimer";
import { useStopTimer } from "./hooks/useStopTimer";
import { sumSeconds, type TimerRow } from "./db/timers";

interface Preferences {
  workdayHours: string;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function syncStatusTag(status: string): { value: string; color: Color } {
  switch (status) {
    case "synced":
      return { value: "Synced", color: Color.Green };
    case "pending":
      return { value: "Pending", color: Color.Orange };
    case "conflict":
      return { value: "Conflict", color: Color.Red };
    default:
      return { value: "Local", color: Color.SecondaryText };
  }
}

function WorklogActions({
  timer,
  isActive,
  showFillGaps,
  onTimerStart,
  onTimerStop,
}: {
  timer: TimerRow;
  isActive: boolean;
  showFillGaps: boolean;
  onTimerStart: () => void;
  onTimerStop: () => void;
}) {
  const startTimer = useStartTimer(onTimerStart);
  const stopTimer = useStopTimer(onTimerStop);

  return (
    <ActionPanel>
      {isActive ? (
        <Action title="Stop Timer" icon={Icon.Stop} onAction={() => stopTimer(timer.issue_key ?? timer.task_id)} />
      ) : (
        <Action
          title="Start Timer"
          icon={Icon.Play}
          onAction={() => startTimer(timer.task_id, timer.issue_key ?? timer.task_id, timer.issue_summary ?? "")}
        />
      )}
      <Action
        title="Sync Worklog"
        icon={Icon.Upload}
        onAction={() =>
          showToast({
            style: Toast.Style.Success,
            title: "Sync Worklog",
            message: `Syncing worklog for ${timer.issue_key ?? timer.task_id}`,
          })
        }
      />
      <Action
        title="Sync Day"
        icon={Icon.Calendar}
        onAction={() =>
          showToast({
            style: Toast.Style.Success,
            title: "Sync Day",
            message: `Syncing all worklogs for ${timer.local_day}`,
          })
        }
      />
      {showFillGaps && (
        <Action
          title="Fill Gaps"
          icon={Icon.PlusCircle}
          onAction={() =>
            showToast({
              style: Toast.Style.Success,
              title: "Fill Gaps",
              message: `Creating adjustment entries to fill gaps in ${timer.local_day}`,
            })
          }
        />
      )}
    </ActionPanel>
  );
}

function useElapsedSeconds(startedAtUtc: string, enabled: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setElapsed(0);
      return;
    }
    setElapsed(Math.floor((Date.now() - new Date(startedAtUtc).getTime()) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAtUtc).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAtUtc, enabled]);

  return elapsed;
}

function WorklogItem({
  timer,
  isActive,
  activeStartedAt,
  showFillGaps,
  onTimerStart,
  onTimerStop,
}: {
  timer: TimerRow;
  isActive: boolean;
  activeStartedAt?: string;
  showFillGaps: boolean;
  onTimerStart: () => void;
  onTimerStop: () => void;
}) {
  const elapsed = useElapsedSeconds(activeStartedAt ?? timer.started_at_utc, isActive);

  return (
    <List.Item
      icon={{ source: timer.issuetype_icon_url ?? "", fallback: Icon.Clock }}
      title={timer.issue_key ?? timer.task_id}
      subtitle={timer.issue_summary ?? undefined}
      accessories={[
        isActive
          ? {
              tag: { value: formatElapsed((timer.duration_seconds ?? 0) + elapsed), color: Color.Green },
              tooltip: "Elapsed time",
            }
          : {
              tag: { value: formatDuration(timer.duration_seconds ?? 0), color: Color.SecondaryText },
              tooltip: "Duration",
            },
        { tag: syncStatusTag(timer.sync_status) },
      ]}
      actions={
        <WorklogActions
          timer={timer}
          isActive={isActive}
          showFillGaps={showFillGaps}
          onTimerStart={onTimerStart}
          onTimerStop={onTimerStop}
        />
      }
    />
  );
}

export default function Command() {
  const { workdayHours } = getPreferenceValues<Preferences>();
  const workdaySeconds = parseFloat(workdayHours) * 3600;

  const { activeTimer, todayTimers, isLoading, refresh } = useTodayWorklogs();

  const totalLogged = sumSeconds(todayTimers);
  const showFillGaps = totalLogged < workdaySeconds;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search today's worklogs...">
      <List.Section
        title="Today"
        subtitle={todayTimers.length > 0 || activeTimer ? `${formatDuration(totalLogged)} logged` : undefined}
      >
        {todayTimers.length === 0 && !isLoading && (
          <List.Item
            title=""
            subtitle="No worklogs for today"
            icon={{ source: Icon.Clock, tintColor: Color.SecondaryText }}
          />
        )}
        {todayTimers.map((timer) => (
          <WorklogItem
            key={timer.task_id}
            timer={timer}
            isActive={activeTimer?.task_id === timer.task_id}
            activeStartedAt={activeTimer?.task_id === timer.task_id ? activeTimer?.started_at_utc : undefined}
            showFillGaps={showFillGaps}
            onTimerStart={refresh}
            onTimerStop={refresh}
          />
        ))}
      </List.Section>
    </List>
  );
}
