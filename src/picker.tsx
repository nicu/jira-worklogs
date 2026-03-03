import { Color, List } from "@raycast/api";
import { useIssues } from "./hooks/useIssues";
import type { JiraIssue } from "./jira/types";

const STATUS_CATEGORY_COLOR: Record<string, Color> = {
  new: Color.Blue,
  indeterminate: Color.Yellow,
  done: Color.Green,
};

function IssueListItem({ issue }: { issue: JiraIssue }) {
  return (
    <List.Item
      icon={{ source: issue.fields.issuetype.iconUrl }}
      title={issue.key}
      subtitle={issue.fields.summary}
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
  const { assigned, watched, isLoading } = useIssues();

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search...">
      <List.Section title="Assigned" subtitle={String(assigned.length)}>
        {assigned.map((issue) => (
          <IssueListItem key={issue.id} issue={issue} />
        ))}
      </List.Section>
      <List.Section title="Watched" subtitle={String(watched.length)}>
        {watched.map((issue) => (
          <IssueListItem key={issue.id} issue={issue} />
        ))}
      </List.Section>
    </List>
  );
}
