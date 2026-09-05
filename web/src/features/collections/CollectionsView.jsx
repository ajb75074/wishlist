import { useEffect, useRef, useState } from "react";
import CollectionThumbnail from "./CollectionThumbnail";
import "./CollectionsView.css";

// Same Material Symbols "more_vert" glyph as LookCard's own KebabIcon -
// not shared/exported there, so duplicated here (matches this app's
// existing convention of small local icon components per file).
function KebabIcon() {
  return (
    <svg viewBox="0 -960 960 960" width="16" height="16" aria-hidden="true">
      <path
        d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"
        fill="currentColor"
      />
    </svg>
  );
}

// One card's own kebab menu (trigger + dropdown). Split out from the
// grid map so its open/closed state and outside-click/Escape handling
// - identical pattern to LookCard's own menu - stay per-card instead of
// needing an "which card's menu is open" index in the parent.
function CollectionCardMenu({ collection, onEdit, onDelete }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target)) return;
      setIsMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="collection-card__menu" ref={menuRef}>
      <button
        type="button"
        className="collection-card__menu-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setIsMenuOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label={`More options for ${collection.name}`}
      >
        <KebabIcon />
      </button>

      {isMenuOpen && (
        <div className="collection-card-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="collection-card-menu__item"
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen(false);
              onEdit(collection);
            }}
          >
            edit
          </button>

          <button
            type="button"
            role="menuitem"
            className="collection-card-menu__item"
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen(false);
              onDelete(collection);
            }}
          >
            delete
          </button>
        </div>
      )}
    </div>
  );
}

// Presentation only - collections/handlers all come from App.jsx.
// No Supabase calls and no modal logic live here.
function CollectionsView({
  collections,
  onCreateCollection,
  onSelectCollection,
  onEditCollection,
  onDeleteCollection,
}) {
  const hasCollections = collections.length > 0;

  return (
    <div className="collections-view">
      {hasCollections ? (
        <div className="collections-grid">
          {collections.map((collection) => (
            <div key={collection.id} className="collection-card-wrapper">
              <button
                type="button"
                className="collection-card"
                onClick={() => onSelectCollection(collection)}
              >
                <span className="collection-card__visual">
                  <CollectionThumbnail
                    imageUrl={collection.imageUrl}
                    color={collection.color}
                    className="collection-card__image"
                  />

                  {/* Purely decorative jewel frame, layered above the
                      photo (not a CSS border-image) so the photo/color
                      shows through its transparent center. Bare
                      relative filename, same convention as every other
                      public/ image in this app (e.g. header.jsx's
                      src="bags.png") - resolved by the browser at
                      runtime relative to the current document, which
                      works in both dev and the packaged Chrome
                      extension without going through Vite's build-time
                      CSS url() rewriting. */}
                  <img
                    className="collection-card__frame"
                    src="border.png"
                    alt=""
                    aria-hidden="true"
                  />
                </span>

                <span className="collection-card__name">{collection.name}</span>
              </button>

              {/* Sibling, not nested, to the card button above - sits
                  over the top-right of the thumbnail rather than beside
                  the name row, so the name stays perfectly centered
                  regardless of whether a menu is present. */}
              <CollectionCardMenu
                collection={collection}
                onEdit={onEditCollection}
                onDelete={onDeleteCollection}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="collections-empty">
          <p className="collections-empty__title">no collections yet ♡</p>
          <p className="collections-empty__subtitle">
            start organizing your saves by trip, vibe, or occasion
          </p>
          <button type="button" onClick={onCreateCollection}>
            create collection
          </button>
        </div>
      )}
    </div>
  );
}

export default CollectionsView;
