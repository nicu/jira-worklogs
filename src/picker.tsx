import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@raycast/api";
import { useIssues } from "./hooks/useIssues";
import type { JiraIssue } from "./jira/types";

const STATUS_CATEGORY_COLOR: Record<string, Color> = {
  new: Color.Blue,
  indeterminate: Color.Yellow,
  done: Color.Green,
};

function IssueListItem({ issue, onRefresh }: { issue: JiraIssue; onRefresh: () => void }) {
  return (
    <List.Item
      icon={{ source: issue.fields.issuetype.iconUrl }}
      title={issue.key}
      subtitle={issue.fields.summary}
      actions={
        <ActionPanel>
          <Action
            title="Select Issue"
            icon={Icon.CheckCircle}
            onAction={() => showToast({ style: Toast.Style.Success, title: issue.key, message: issue.fields.summary })}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
      accessories={[
        {
          tag: {
            value: issue.fields.status.name,
            color: STATUS_CATEGORY_COLOR[issue.fields.status.statusCategory.key] ?? Color.SecondaryText,
          },
        },
        issue.fields.assignee
          ? { icon: { source: issue.fields.assignee.avatarUrls["32x32"] }, tooltip: issue.fields.assignee.displayName }
          : {},
        issue.fields.priority
          ? { icon: { source: issue.fields.priority.iconUrl }, tooltip: issue.fields.priority.name }
          : {},
      ]}
    />
  );
}

export default function Command() {
  const { assigned, watched, isLoading, refresh } = useIssues();

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search...">
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
