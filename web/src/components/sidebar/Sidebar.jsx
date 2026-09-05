import { useLocation, useNavigate } from "react-router-dom";
import CollectionThumbnail from "../../features/collections/CollectionThumbnail";
import { useAuth } from "../../lib/AuthContext";
import "./Sidebar.css";

function Sidebar({
  activeView,
  onViewChange,
  collections,
  onCreateCollection,
  onSelectCollection,
  selectedCollectionId,
}) {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button
          className={activeView === "all" ? "active" : ""}
          onClick={() => onViewChange("all")}
        >
          All Saves
        </button>

        <button
          className={activeView === "collections" ? "active" : ""}
          onClick={() => onViewChange("collections")}
        >
          Collections
        </button>

        {/* Its own active check (not activeView) - Profile isn't part
            of the All Saves/Collections drill-down App.jsx already
            tracks, so it doesn't need to flow through onViewChange. */}
        <button
          className={location.pathname === "/profile" ? "active" : ""}
          onClick={() => navigate("/profile")}
        >
          Profile
        </button>
      </nav>

      <div className="sidebar-divider" />

      <section className="sidebar-collections">
        <p className="sidebar-label">my collections ♡</p>

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

        {/* Image + label are one clickable unit - a slightly tilted
            scrapbook sticker, not another list row */}
        <button
          type="button"
          className="sidebar-new-collection"
          onClick={onCreateCollection}
        >
          <span className="sidebar-new-collection__label">
            <span>new ♡</span>
            <span>collection</span>
          </span>

          <img
            className="sidebar-new-collection__image"
            src="collection.png"
            alt=""
          />
        </button>
      </section>

      <div className="sidebar-divider" />

      {/* Functional-only, unobtrusive placement - real placement/styling
          comes with the visual redesign. */}
      <button type="button" className="sidebar-sign-out" onClick={signOut}>
        sign out
      </button>
    </aside>
  );
}

export default Sidebar;
