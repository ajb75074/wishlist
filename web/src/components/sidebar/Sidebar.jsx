import { useLocation, useNavigate } from "react-router-dom";
import CollectionThumbnail from "../../features/collections/CollectionThumbnail";
import logo from "../../assets/logo.png";
import starIcon from "../../assets/star.png";
import "./Sidebar.css";

// Simple line icons, matching the "quiet nav rail" brief - deliberately
// not the app's earlier blocky/filled icon style, which reads heavier
// than this redesign wants the navigation to feel.
function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M3 9.5 10 3l7 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V17h10V8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function CollectionsIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 17c1-4 4-5.5 6.5-5.5s5.5 1.5 6.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Sidebar({
  activeView,
  onViewChange,
  collections,
  onCreateCollection,
  onSelectCollection,
  selectedCollectionId,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isProfileActive = location.pathname === "/profile";

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-wordmark">
          <img className="sidebar-wordmark__logo" src={logo} alt="Wishlist" />
        </div>

        {/* Home/Collections/Profile are this app's only real top-level
            destinations - no Look Studio or Calendar entry here, since
            neither has an actual standalone page to land on (Look
            Studio only exists inside a specific look, opened from
            Collections). */}
        <nav className="sidebar-nav">
          <button
            className={activeView === "all" && !isProfileActive ? "active" : ""}
            onClick={() => onViewChange("all")}
          >
            <HomeIcon /> Home
          </button>

          <button
            className={activeView === "collections" && !isProfileActive ? "active" : ""}
            onClick={() => onViewChange("collections")}
          >
            <CollectionsIcon /> Collections
          </button>

          <button
            className={isProfileActive ? "active" : ""}
            onClick={() => navigate("/profile")}
          >
            <ProfileIcon /> Profile
          </button>
        </nav>

        <div className="sidebar-divider" />

        <section className="sidebar-collections">
          <p className="sidebar-label">My Collections</p>

          {/* Full list lives on the Collections page (via the nav button
              above) - the sidebar itself only previews the most recent
              few, most-recent-first since getCollections() already
              orders that way, so this stays a quick glance, not a
              second full list. */}
          {collections.slice(0, 3).map((collection) => (
            <button
              key={collection.id}
              className={`sidebar-collection-item ${
                collection.id === selectedCollectionId ? "active" : ""
              }`}
              onClick={() => onSelectCollection(collection)}
            >
              <CollectionThumbnail
                imageUrl={collection.imageUrl}
                color={collection.color}
                size={28}
              />
              {collection.name}
            </button>
          ))}

          <button
            type="button"
            className="sidebar-new-collection"
            onClick={onCreateCollection}
          >
            <PlusIcon /> New Collection
          </button>
        </section>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-star">
          <img src={starIcon} alt="" aria-hidden="true" />
        </div>

        <p className="sidebar-whimsy">
          <span>manifesting this</span>
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
