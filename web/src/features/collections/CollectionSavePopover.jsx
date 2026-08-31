import { useEffect, useRef, useState } from "react";
import CollectionThumbnail from "./CollectionThumbnail";
import { addItemToCollection, getCollectionsForItem } from "./collections";
import "./CollectionSavePopover.css";

const POPOVER_WIDTH = 260;
const POPOVER_MAX_HEIGHT = 340;
const VIEWPORT_MARGIN = 12;

// Fixed positioning is computed once from the trigger button's own
// screen position - no page coordinates hardcoded, and no dependency
// on nesting inside ProductCard (which clips overflow).
function getPosition(anchorRect) {
  let left = anchorRect.right - POPOVER_WIDTH;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN),
  );

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUpward =
    spaceBelow < POPOVER_MAX_HEIGHT && anchorRect.top > POPOVER_MAX_HEIGHT;

  const top = openUpward
    ? Math.max(VIEWPORT_MARGIN, anchorRect.top - POPOVER_MAX_HEIGHT - 8)
    : anchorRect.bottom + 8;

  return { top, left };
}

// App only renders this while a product's popover should be open, so
// each open is a fresh mount - search/success/error state starts
// clean for free. Calls collections.js directly (unlike ProductCard,
// which never touches Supabase) since membership status is
// popover-local UI state, not something the rest of the app reads.
function CollectionSavePopover({
  product,
  collections,
  anchorRect,
  anchorEl,
  onClose,
  onCreateCollection,
}) {
  const [position] = useState(() => getPosition(anchorRect));
  const [searchTerm, setSearchTerm] = useState("");
  const [memberIds, setMemberIds] = useState(null); // null = still loading
  const [addingId, setAddingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const popoverRef = useRef(null);
  const successTimeoutRef = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadMemberships() {
      try {
        const memberCollections = await getCollectionsForItem(product.id);
        if (isCurrent) {
          setMemberIds(new Set(memberCollections.map((collection) => collection.id)));
        }
      } catch {
        if (isCurrent) {
          setMemberIds(new Set());
          setErrorMessage("couldn't load this product's collections");
        }
      }
    }

    loadMemberships();

    return () => {
      isCurrent = false;
    };
  }, [product.id]);

  // Closes on outside click/Escape. mousedown (not click) on the
  // trigger button is explicitly ignored so a second click on it can
  // toggle-close via the button's own handler in App.jsx, instead of
  // this listener closing it first and the click reopening it.
  useEffect(() => {
    function handlePointerDown(event) {
      if (popoverRef.current?.contains(event.target)) return;
      if (anchorEl?.contains(event.target)) return;
      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorEl, onClose]);

  useEffect(() => {
    return () => clearTimeout(successTimeoutRef.current);
  }, []);

  async function handleAddToCollection(collection) {
    if (memberIds?.has(collection.id) || addingId) {
      return;
    }

    setAddingId(collection.id);
    setErrorMessage("");

    try {
      await addItemToCollection(collection.id, product.id);

      setMemberIds((current) => new Set(current).add(collection.id));
      setSuccessMessage(`added to ${collection.name} ♡`);

      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 2200);
    } catch {
      setErrorMessage("couldn't add to collection — try again");
    } finally {
      setAddingId(null);
    }
  }

  const query = searchTerm.trim().toLowerCase();
  const visibleCollections = query
    ? collections.filter((collection) =>
        collection.name.toLowerCase().includes(query),
      )
    : collections;

  return (
    <div
      ref={popoverRef}
      className="collection-save-popover"
      style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
      role="dialog"
      aria-label={`Save "${product.name}" to a collection`}
    >
      <p className="collection-save-popover__title">save to collection ♡</p>

      {collections.length > 0 && (
        <input
          type="text"
          className="collection-save-popover__search"
          placeholder="search collections..."
          aria-label="Search collections"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      )}

      {successMessage && (
        <p className="collection-save-popover__success">{successMessage}</p>
      )}

      {errorMessage && (
        <p className="collection-save-popover__error">{errorMessage}</p>
      )}

      {memberIds === null ? (
        <p className="collection-save-popover__status">loading...</p>
      ) : collections.length === 0 ? (
        <div className="collection-save-popover__empty">
          <p>no collections yet ♡</p>
        </div>
      ) : (
        <ul className="collection-save-popover__list">
          {visibleCollections.map((collection) => {
            const isMember = memberIds.has(collection.id);
            const isAdding = addingId === collection.id;

            return (
              <li key={collection.id}>
                <button
                  type="button"
                  className="collection-save-popover__row"
                  onClick={() => handleAddToCollection(collection)}
                  disabled={isMember || isAdding}
                >
                  <CollectionThumbnail
                    imageUrl={collection.imageUrl}
                    color={collection.color}
                    size={26}
                  />

                  <span className="collection-save-popover__row-name">
                    {collection.name}
                  </span>

                  {isMember && (
                    <span className="collection-save-popover__badge">
                      ✓ added
                    </span>
                  )}

                  {isAdding && (
                    <span className="collection-save-popover__badge">
                      adding...
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {visibleCollections.length === 0 && (
            <li className="collection-save-popover__no-matches">no matches</li>
          )}
        </ul>
      )}

      <button
        type="button"
        className="collection-save-popover__create"
        onClick={onCreateCollection}
      >
        + create collection
      </button>
    </div>
  );
}

export default CollectionSavePopover;
