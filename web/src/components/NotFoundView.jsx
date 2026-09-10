import { Link } from "react-router-dom";
import "./NotFoundView.css";

function NotFoundView() {
  return (
    <div className="not-found">
      <p className="not-found__title">page not found ♡</p>
      <p className="not-found__subtitle">
        this link doesn't lead anywhere - it may be old, or mistyped.
      </p>
      <Link to="/" className="not-found__link">
        back to your wishlist
      </Link>
    </div>
  );
}

export default NotFoundView;
