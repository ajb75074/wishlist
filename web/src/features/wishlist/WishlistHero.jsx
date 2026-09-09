import { useNavigate } from "react-router-dom";
import { useProfile } from "../profile/useProfile";
import "./WishlistHero.css";

// The Wishlist page's own global header + hero - deliberately separate
// from components/header/Header (still used as-is by Collections) so
// restyling this page can never change how Collections looks. Owns
// nothing: search term and its setter are App.jsx's own state, passed
// straight through, same as the old Header did.
function WishlistHero({ searchTerm, onSearchChange }) {
  const navigate = useNavigate();
  const { displayName, profileImageUrl, isLoading } = useProfile();

  const firstName = (displayName || "").trim().split(/\s+/)[0] || "";
  const initial = firstName ? firstName[0].toUpperCase() : "";

  return (
    <div className="wishlist-hero">
      <div className="wishlist-hero__bar">
        <label className="wishlist-hero__search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search your wishlist..."
            aria-label="Search your wishlist"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        {/* Surfaces the same Profile destination the Sidebar already
            links to - not a new menu, just a second, personal-feeling
            entry point to it. No notifications control: this app has
            no notification system to wire one up to. */}
        <button
          type="button"
          className="wishlist-hero__profile"
          onClick={() => navigate("/profile")}
          aria-label="View profile"
        >
          <span className="wishlist-hero__avatar">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" />
            ) : (
              <span className="wishlist-hero__avatar-fallback">{initial}</span>
            )}
          </span>

          {!isLoading && firstName && (
            <span className="wishlist-hero__greeting">hi, {firstName} ♡</span>
          )}

          <span className="wishlist-hero__chevron" aria-hidden="true">⌄</span>
        </button>
      </div>

      <div className="wishlist-hero__identity">
        <h1 className="wishlist-hero__title">My Wishlist</h1>

        <p className="wishlist-hero__subtitle">a visual archive of pieces i love</p>
      </div>
    </div>
  );
}

export default WishlistHero;
