import { useParams } from "react-router-dom";
import { Toolbar } from "../components/common/Toolbar";
import { EmptyState } from "../components/common/EmptyState";

export default function PullDetailPage() {
  const { owner, repo, number } = useParams();
  return (
    <div>
      <Toolbar
        title={`${owner}/${repo} #${number}`}
        subtitle="Pull request detail"
      />
      <EmptyState
        title="Detail coming in M5"
        subtitle="PR detail view will be implemented in M5."
      />
    </div>
  );
}
