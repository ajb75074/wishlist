import { useEffect, useRef, useState } from "react";
import CollectionThumbnail from "./CollectionThumbnail";
import ProductGrid from "../wishlist/ProductGrid";
import SelectModeBar from "../../components/SelectModeBar";
import ActionTray from "../../components/ActionTray";
import { getCollectionItems, removeItemFromCollection } from "./collections";
import "./CollectionDetailView.css";

// Owns its own fetched product list (separate from the global wishlist
// state in App.jsx) - App.jsx only owns which collection is selected.
// Also owns its own Select Mode / "remove from this rack" state, kept
// isolated here since it's specific to this collection, unlike All
// Saves' select state which App.jsx owns.
function CollectionDetailView({
  collection,
  onBack,
  onUpdate,
  updatingId,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const successTimeoutRef = useRef(null);
  // Pieces/Looks is local view state, not navigation - App.jsx never
  // needs to know which one is showing.
  const [activeTab, setActiveTab] = useState("pieces");

  // Switching to a different collection (e.g. via the Sidebar, without
  // ever unmounting this view) shouldn't carry over select state from
  // the collection we just left - same render-time reset pattern used
  // elsewhere in this app to react to a prop change without an effect.
  const [lastCollectionId, setLastCollectionId] = useState(collection.id);
  if (collection.id !== lastCollectionId) {
    setLastCollectionId(collection.id);
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
    setRemoveError("");
    setSuccessMessage("");
    setActiveTab("pieces");
  }

  useEffect(() => {
    return () => clearTimeout(successTimeoutRef.current);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadItems() {
      setLoading(true);
      setError(null);

      try {
        const items = await getCollectionItems(collection.id);
        if (isCurrent) {
          setProducts(items);
        }
      } catch {
        if (isCurrent) {
          setError("Could not load this collection.");
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    loadItems();

    // Avoids setting state from a stale fetch if the user switches
    // collections again before this one finishes loading.
    return () => {
      isCurrent = false;
    };
  }, [collection.id]);

  // Same idea for edits: the real update still goes through App.jsx's
  // existing handler; this just mirrors the result into the local copy.
  async function handleUpdate(id, updates) {
    const result = await onUpdate(id, updates);

    if (result?.success && result.product) {
      setProducts((current) =>
        current.map((product) => (product.id === id ? result.product : product)),
      );
    }

    return result;
  }

  function handleEnterSelectMode() {
    setIsSelectMode(true);
    setSelectedProductIds(new Set());
  }

  function handleCancelSelectMode() {
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
  }

  function handleToggleProductSelected(id) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // "Remove from this rack ♡" only touches this collection's own
  // collection_items relationship - the wishlist item itself, and its
  // membership in any other collection, is untouched. Non-destructive
  // to the wishlist, so no confirmation modal (matches Donate, which
  // IS destructive and does need one).
  async function handleRemoveFromRack() {
    const ids = Array.from(selectedProductIds);

    setIsRemoving(true);
    setRemoveError("");

    try {
      await Promise.all(
        ids.map((id) => removeItemFromCollection(collection.id, id)),
      );

      setProducts((current) =>
        current.filter((product) => !selectedProductIds.has(product.id)),
      );

      setSuccessMessage(
        ids.length === 1
          ? `removed from ${collection.name} ♡`
          : `removed ${ids.length} pieces from ${collection.name} ♡`,
      );
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 2200);

      setIsSelectMode(false);
      setSelectedProductIds(new Set());
    } catch {
      setRemoveError("couldn't remove from this collection — try again");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="collection-detail">
      <button
        type="button"
        className="collection-detail__back"
        onClick={onBack}
      >
        ← Collections
      </button>

      <div className="collection-detail__heading">
        <CollectionThumbnail
          imageUrl={collection.imageUrl}
          color={collection.color}
          size={96}
          className="collection-detail__thumbnail"
        />

        <div>
          <h2>{collection.name}</h2>
          <p>pieces saved for this collection ♡</p>
        </div>
      </div>

      <div className="collection-tabs">
        <button
          type="button"
          className={`collection-tabs__tab${activeTab === "pieces" ? " is-active" : ""}`}
          onClick={() => setActiveTab("pieces")}
        >
          Pieces
        </button>
        <button
          type="button"
          className={`collection-tabs__tab${activeTab === "looks" ? " is-active" : ""}`}
          onClick={() => setActiveTab("looks")}
        >
          Looks
        </button>
      </div>

      {activeTab === "pieces" && (
        <>
          {loading && (
            <p className="collection-detail__status">Loading...</p>
          )}

          {!loading && error && (
            <p className="collection-detail__status collection-detail__status--error">
              {error}
            </p>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="toolbar-row">
              <SelectModeBar
                isActive={isSelectMode}
                selectedCount={selectedProductIds.size}
                onEnter={handleEnterSelectMode}
                onCancel={handleCancelSelectMode}
              />
            </div>
          )}

          {successMessage && (
            <p className="collection-detail__success">{successMessage}</p>
          )}

          {removeError && (
            <p className="collection-detail__status collection-detail__status--error">
              {removeError}
            </p>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="collection-detail__empty">
              <p className="collection-detail__empty-title">nothing here yet ♡</p>
              <p className="collection-detail__empty-subtitle">
                add saved pieces to this collection to start building the mood
              </p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <ProductGrid
              products={products}
              onUpdate={handleUpdate}
              updatingId={updatingId}
              context="collection"
              isSelectMode={isSelectMode}
              selectedProductIds={selectedProductIds}
              onToggleSelect={handleToggleProductSelected}
            />
          )}

          {isSelectMode && selectedProductIds.size > 0 && (
            <ActionTray>
              <button
                type="button"
                className="action-tray__button action-tray__button--primary"
                onClick={handleRemoveFromRack}
                disabled={isRemoving}
              >
                {isRemoving ? "removing..." : "remove from rack ♡"}
              </button>
            </ActionTray>
          )}
        </>
      )}

      {activeTab === "looks" && (
        <div className="collection-detail__looks-empty">
          <p className="collection-detail__looks-heart">♡</p>
          <p className="collection-detail__looks-title">no looks planned yet</p>
          <p className="collection-detail__looks-subtitle">
            start putting together outfits
            <br />
            for {collection.name}
          </p>
          <button type="button" className="collection-detail__create-look">
            + create a look
          </button>
        </div>
      )}
    </div>
  );
}

export default CollectionDetailView;
