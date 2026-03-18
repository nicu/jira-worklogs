import { Action, ActionPanel, Color, Icon, List, useNavigation } from "@raycast/api";
// import { useIssues } from "./hooks/useIssues";
import { useStartTimer } from "./hooks/useStartTimer";
import type { JiraIssue } from "./jira/types";
import TodayCommand from "./today";
import { MockJiraIssue } from "./mocks/jira.mock";
import { faker } from "@faker-js/faker/locale/zu_ZA";

const STATUS_CATEGORY_COLOR: Record<string, Color> = {
  new: Color.Blue,
  indeterminate: Color.Yellow,
  done: Color.Green,
};

const EMPTY_ACCESSORRY = "    ";

function IssueListItem({ issue, onRefresh }: { issue: JiraIssue; onRefresh: () => void }) {
  const { push } = useNavigation();
  const startTimer = useStartTimer(() => push(<TodayCommand />));

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
            onAction={() => startTimer(issue.id, issue.key, issue.fields.summary)}
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
        issue.fields.priority
          ? { icon: { source: issue.fields.priority.iconUrl }, tooltip: issue.fields.priority.name }
          : {},
        issue.fields.assignee
          ? { icon: { source: issue.fields.assignee.avatarUrls["32x32"] }, tooltip: issue.fields.assignee.displayName }
          : {},
        {
          tag: {
            value: issue.fields.status.name,
            color: STATUS_CATEGORY_COLOR[issue.fields.status.statusCategory.key] ?? Color.SecondaryText,
          },
        },
      ]}
    />
  );
}

export default function Command() {
  // const { assigned, watched, isLoading, refresh } = useIssues();
  const assigned = faker.helpers.multiple(() => MockJiraIssue(), { count: { min: 3, max: 25 } });
  const watched = faker.helpers.multiple(() => MockJiraIssue(), { count: { min: 3, max: 25 } });
  const isLoading = false;
  const refresh = () => {};

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
