import { useParams } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function IssueDetailPage() {
  const { owner, repo, number } = useParams();
  return (
    <div>
      <Toolbar
        title={`${owner}/${repo} #${number}`}
        subtitle="Issue detail"
      />
      <EmptyState
        title="Detail coming in M6"
        subtitle="Issue detail view will be implemented in M6."
      />
    </div>
  );
}
