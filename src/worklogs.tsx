import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Color,
  Form,
  Icon,
  LaunchType,
  List,
  launchCommand,
  open,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { getLocalDay, sumTotalSeconds, type WorklogRow } from "./db/timers";
import { useStartTimer } from "./hooks/useStartTimer";
import { useSaveWorklogsToJira } from "./hooks/useSaveWorklogsToJira";
import { useStopTimer } from "./hooks/useStopTimer";
import { getIssueBrowseUrl } from "./jira/jira.service";
import { useWorklogs } from "./hooks/useWorklogs";
import {
  formatDateInputValue,
  formatDayLabel,
  formatDuration,
  formatElapsed,
  parseDateInput,
  shiftDateByDays,
  startOfDay,
} from "./utils/time";

type DateFormValues = {
  dateInput: string;
};

async function openCommand(name: "select-issue" | "worklogs") {
  await launchCommand({ name, type: LaunchType.UserInitiated });
}

function formatTotal(totalSeconds: number): string | undefined {
  return totalSeconds > 0 ? formatDuration(totalSeconds) : undefined;
}

function DateInputView({ date, onSelect }: { date: Date; onSelect: (date: Date) => void }) {
  const { pop } = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Show Worklogs"
            onSubmit={async (values: DateFormValues) => {
              const parsedDate = parseDateInput(values.dateInput, new Date());
              if (!parsedDate) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Couldn't Parse Date",
                  message:
                    "Use YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, today, or yesterday. Use ISO for ambiguous slash dates.",
                });
                return;
              }

              const nextDate = startOfDay(parsedDate);
              if (nextDate.getTime() > startOfDay(new Date()).getTime()) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Date Is in the Future",
                  message: "Pick today or an earlier date.",
                });
                return;
              }

              onSelect(nextDate);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Accepted Formats"
        text="Examples: 2026-03-18, 18-03-2026, 18/03/2026, 03/18/2026, today, yesterday. Use ISO for ambiguous slash dates."
      />
      <Form.TextField id="dateInput" title="Date" defaultValue={formatDateInputValue(date)} placeholder="2026-03-18" />
    </Form>
  );
}

function NavigationActions({
  selectedDate,
  onSelectDate,
  onRefresh,
  onSaveDay,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onRefresh: () => void;
  onSaveDay: () => void;
}) {
  const isToday = getLocalDay(selectedDate) === getLocalDay();

  return (
    <>
      <Action
        title="Select Issue"
        icon={Icon.MagnifyingGlass}
        shortcut={{ modifiers: ["cmd"], key: "n" }}
        onAction={() => openCommand("select-issue")}
      />
      <Action
        title="Previous Day"
        icon={Icon.ArrowLeft}
        shortcut={{ modifiers: ["cmd"], key: "[" }}
        onAction={() => onSelectDate(shiftDateByDays(selectedDate, -1))}
      />
      <Action
        title="Next Day"
        icon={Icon.ArrowRight}
        shortcut={{ modifiers: ["cmd"], key: "]" }}
        onAction={() => onSelectDate(shiftDateByDays(selectedDate, 1))}
      />
      {!isToday ? (
        <Action
          title="Jump to Today"
          icon={Icon.Calendar}
          shortcut={{ modifiers: ["cmd"], key: "t" }}
          onAction={() => onSelectDate(startOfDay(new Date()))}
        />
      ) : null}
      <Action.Push
        title="Pick Date"
        icon={Icon.Calendar}
        shortcut={{ modifiers: ["cmd"], key: "d" }}
        target={<DateInputView date={selectedDate} onSelect={onSelectDate} />}
      />
      <Action
        title="Refresh from Jira"
        icon={Icon.ArrowClockwise}
        shortcut={{ modifiers: ["cmd"], key: "r" }}
        onAction={onRefresh}
      />
      <Action
        title="Save Day to Jira"
        icon={Icon.Upload}
        shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
        onAction={onSaveDay}
      />
    </>
  );
}

function useElapsedSeconds(startedAtUtc?: string, enabled = false): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled || !startedAtUtc) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAtUtc).getTime()) / 1000));
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, [enabled, startedAtUtc]);

  return elapsed;
}

function WorklogActions({
  worklog,
  isActive,
  selectedDate,
  onSelectDate,
  onReload,
  onRefresh,
  onSaveIssue,
  onSaveDay,
}: {
  worklog: WorklogRow;
  isActive: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onReload: () => void;
  onRefresh: () => void;
  onSaveIssue: () => void;
  onSaveDay: () => void;
}) {
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer(onReload);
  const issueKey = worklog.issue_key;

  return (
    <ActionPanel>
      {isActive ? (
        <Action title="Stop Timer" icon={Icon.Stop} onAction={() => stopTimer(worklog.issue_key ?? worklog.task_id)} />
      ) : (
        <Action
          title="Start Timer"
          icon={Icon.Play}
          onAction={() =>
            startTimer(
              worklog.task_id,
              worklog.issue_key ?? worklog.task_id,
              worklog.issue_summary ?? "",
              worklog.issuetype_icon_url ?? undefined,
            )
          }
        />
      )}
      {issueKey ? (
        <Action
          title="Open Issue in Browser"
          icon={Icon.Globe}
          onAction={async () => open(await getIssueBrowseUrl(issueKey))}
        />
      ) : null}
      <Action
        title="Save to Jira"
        icon={Icon.Upload}
        onAction={onSaveIssue}
        shortcut={{ modifiers: ["cmd"], key: "s" }}
      />
      <NavigationActions
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onRefresh={onRefresh}
        onSaveDay={onSaveDay}
      />
    </ActionPanel>
  );
}

function WorklogItem({
  worklog,
  isActive,
  activeStartedAt,
  selectedDate,
  onSelectDate,
  onReload,
  onRefresh,
  onSaveIssue,
  onSaveDay,
}: {
  worklog: WorklogRow;
  isActive: boolean;
  activeStartedAt?: string;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onReload: () => void;
  onRefresh: () => void;
  onSaveIssue: () => void;
  onSaveDay: () => void;
}) {
  const elapsed = useElapsedSeconds(activeStartedAt, isActive);
  const totalSeconds = worklog.total_duration_seconds + elapsed;
  const totalLabel = isActive ? formatElapsed(totalSeconds) : formatDuration(totalSeconds);
  const showSynced = worklog.is_synced === 1 && !isActive;

  return (
    <List.Item
      icon={{ source: worklog.issuetype_icon_url || Icon.Clock }}
      title={worklog.issue_key ?? worklog.task_id}
      subtitle={worklog.issue_summary ?? undefined}
      accessories={[
        ...(totalSeconds > 0 || isActive
          ? [
              {
                tag: {
                  value: totalLabel,
                  color: isActive ? Color.Red : Color.SecondaryText,
                },
                tooltip: isActive ? "Currently tracking" : "Total logged time",
              },
            ]
          : []),
        ...(showSynced
          ? [
              {
                icon: { source: Icon.CheckCircle, tintColor: Color.Green },
                tooltip: "Synced with Jira",
              },
            ]
          : []),
      ]}
      actions={
        <WorklogActions
          worklog={worklog}
          isActive={isActive}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onReload={onReload}
          onRefresh={onRefresh}
          onSaveIssue={onSaveIssue}
          onSaveDay={onSaveDay}
        />
      }
    />
  );
}

export default function Command() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const selectedLocalDay = getLocalDay(selectedDate);
  const isToday = selectedLocalDay === getLocalDay();
  const { activeTimer, worklogs, isLoading, isSyncingRemote, error, reload, refresh } = useWorklogs(selectedLocalDay);
  const { saveIssue, saveDay } = useSaveWorklogsToJira(reload);
  const activeElapsed = useElapsedSeconds(activeTimer?.started_at_utc, isToday && Boolean(activeTimer));
  const totalSeconds = sumTotalSeconds(worklogs) + activeElapsed;
  const sectionTitle = formatDayLabel(selectedDate);
  const sectionSubtitle = formatTotal(totalSeconds);

  if (!isLoading && worklogs.length === 0) {
    return (
      <List
        isLoading={isLoading || isSyncingRemote}
        searchBarPlaceholder={`Search ${sectionTitle.toLowerCase()} worklogs...`}
      >
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.Clock}
          title={error ? "Couldn't Load Worklogs" : isSyncingRemote ? "Refreshing from Jira..." : "No Worklogs"}
          description={error ? error.message : `No worklogs for ${sectionTitle.toLowerCase()}.`}
          actions={
            <ActionPanel>
              <NavigationActions
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onRefresh={refresh}
                onSaveDay={() => saveDay(selectedLocalDay)}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading || isSyncingRemote}
      searchBarPlaceholder={`Search ${sectionTitle.toLowerCase()} worklogs...`}
    >
      <List.Section
        title={sectionTitle}
        subtitle={
          isSyncingRemote ? `${sectionSubtitle ? `${sectionSubtitle} · ` : ""}refreshing Jira...` : sectionSubtitle
        }
      >
        {worklogs.map((worklog) => (
          <WorklogItem
            key={worklog.task_id}
            worklog={worklog}
            isActive={isToday && activeTimer?.task_id === worklog.task_id}
            activeStartedAt={
              isToday && activeTimer?.task_id === worklog.task_id ? activeTimer.started_at_utc : undefined
            }
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onReload={reload}
            onRefresh={refresh}
            onSaveIssue={() => saveIssue(worklog.task_id, worklog.issue_key ?? worklog.task_id, selectedLocalDay)}
            onSaveDay={() => saveDay(selectedLocalDay)}
          />
        ))}
      </List.Section>
    </List>
  );
}
