import { Link } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/common/Button";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      subtitle="The page you requested does not exist."
      actions={
        <Link to="/inbox">
          <Button variant="ghost">Go to Inbox</Button>
        </Link>
      }
    />
  );
}
