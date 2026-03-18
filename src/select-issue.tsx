import { Action, ActionPanel, Color, Icon, LaunchType, List, launchCommand, open } from "@raycast/api";
import { useIssues } from "./hooks/useIssues";
import { getIssueBrowseUrl } from "./jira/jira.service";
import { useStartTimer } from "./hooks/useStartTimer";
import type { JiraIssue } from "./jira/types";

const STATUS_CATEGORY_COLOR: Record<string, Color> = {
  new: Color.Blue,
  indeterminate: Color.Yellow,
  done: Color.Green,
};

async function openWorklogs() {
  await launchCommand({ name: "worklogs", type: LaunchType.UserInitiated });
}

function IssueListItem({ issue, onRefresh }: { issue: JiraIssue; onRefresh: () => void }) {
  const startTimer = useStartTimer();

  return (
    <List.Item
      icon={{ source: issue.fields.issuetype.iconUrl }}
      title={issue.key}
      subtitle={issue.fields.summary}
      actions={
        <ActionPanel>
          <Action
            title="Start Timer"
            icon={Icon.Play}
            onAction={() => startTimer(issue.id, issue.key, issue.fields.summary, issue.fields.issuetype.iconUrl)}
          />
          <Action
            title="Open Issue in Browser"
            icon={Icon.Globe}
            onAction={async () => open(await getIssueBrowseUrl(issue.key))}
          />
          <Action title="Open Worklogs" icon={Icon.List} onAction={openWorklogs} />
          <Action
            title="Refresh Issues"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
      accessories={[
        issue.fields.assignee
          ? { icon: { source: issue.fields.assignee.avatarUrls["32x32"] }, tooltip: issue.fields.assignee.displayName }
          : {},
        {
          tag: {
            value: issue.fields.status.name,
            color: STATUS_CATEGORY_COLOR[issue.fields.status.statusCategory.key] ?? Color.SecondaryText,
          },
        },
        issue.fields.priority
          ? { icon: { source: issue.fields.priority.iconUrl }, tooltip: issue.fields.priority.name }
          : {},
      ]}
    />
  );
}

export default function Command() {
  const { assigned, watched, isLoading, error, refresh } = useIssues();
  const hasIssues = assigned.length > 0 || watched.length > 0;

  if (!isLoading && !hasIssues) {
    return (
      <List isLoading={isLoading} searchBarPlaceholder="Search Jira issues...">
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.MagnifyingGlass}
          title={error ? "Couldn't Load Jira Issues" : "No Issues Found"}
          description={error ? error.message : "No assigned or watched Jira issues are available right now."}
          actions={
            <ActionPanel>
              <Action title="Refresh Issues" icon={Icon.ArrowClockwise} onAction={refresh} />
              <Action title="Open Worklogs" icon={Icon.List} onAction={openWorklogs} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Jira issues...">
      <List.Section title="Assigned" subtitle={String(assigned.length)}>
        {assigned.map((issue) => (
          <IssueListItem key={issue.id} issue={issue} onRefresh={refresh} />
        ))}
      </List.Section>
      <List.Section title="Watched" subtitle={String(watched.length)}>
        {watched.map((issue) => (
          <IssueListItem key={issue.id} issue={issue} onRefresh={refresh} />
        ))}
      </List.Section>
    </List>
  );
}
