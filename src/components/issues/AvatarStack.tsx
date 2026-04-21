import { Avatar } from "../common/Avatar";
import type { IssueAssigneeInfo } from "../../stores/dataStore";

export interface AvatarStackProps {
  users: IssueAssigneeInfo[];
  max?: number;
}

export function AvatarStack({ users, max = 3 }: AvatarStackProps) {
  if (users.length === 0) return null;
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <div className="inline-flex items-center" style={{ paddingLeft: 6 }}>
      {visible.map((u, i) => (
        <span
          key={u.login}
          style={{
            marginLeft: i === 0 ? -6 : -6,
            zIndex: visible.length - i,
            position: "relative",
            display: "inline-block",
          }}
        >
          <Avatar login={u.login} src={u.avatarUrl} size="xs" />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="ml-1 text-[10px] inline-flex items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            width: 16,
            height: 16,
            border: "1px solid var(--border-subtle)",
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
