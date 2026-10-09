import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="empty-card">
      <h1>Page not found</h1>
      <p>Return to your workout log to keep training.</p>
      <Link to="/" className="secondary">
        Back to workouts
      </Link>
    </div>
  );
}
