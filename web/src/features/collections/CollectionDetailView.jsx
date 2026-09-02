import { useEffect, useRef, useState } from "react";
import CollectionThumbnail from "./CollectionThumbnail";
import ProductGrid from "../wishlist/ProductGrid";
import SelectModeBar from "../../components/SelectModeBar";
import ActionTray from "../../components/ActionTray";
import CreateLookModal from "./CreateLookModal";
import LookCard from "./LookCard";
import LookDetailView from "./LookDetailView";
import DeleteLookModal from "./DeleteLookModal";
import { getCollectionItems, removeItemFromCollection } from "./collections";
import { updateWishitemCutoutImage, uploadPieceCutout } from "../wishlist/wishlist";
import {
  createLook,
  deleteLook,
  getLooksForCollection,
  saveLookIllustration,
  updateLookLayout,
} from "./looks";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";
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
  const [looks, setLooks] = useState([]);
  const [isLooksLoading, setIsLooksLoading] = useState(true);
  const [isCreateLookModalOpen, setIsCreateLookModalOpen] = useState(false);
  const [selectedLook, setSelectedLook] = useState(null);
  const [lookPendingRemoval, setLookPendingRemoval] = useState(null);
  const [isRemovingLook, setIsRemovingLook] = useState(false);
  const [removeLookError, setRemoveLookError] = useState("");

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
    setSelectedLook(null);
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

  useEffect(() => {
    let isCurrent = true;

    async function loadLooks() {
      setIsLooksLoading(true);

      try {
        const items = await getLooksForCollection(collection.id);
        if (isCurrent) {
          setLooks(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isCurrent) {
          setIsLooksLoading(false);
        }
      }
    }

    loadLooks();

    return () => {
      isCurrent = false;
    };
  }, [collection.id]);

  // Background, silent refetches when this tab regains focus - covers
  // "saved a wishlist item / prepared a cutout / saved an illustration
  // via another tab or the Chrome extension while this one sat open."
  // No loading state toggled here on purpose: this should feel like the
  // data was just already there, not like the page reloaded. Reads
  // collection.id fresh via closure each render (useRefetchOnFocus
  // always calls the latest callback it was given), so switching
  // collections doesn't need to be handled specially here - the
  // isCurrent-guarded mount effects above still own the "first load for
  // this collection" case untouched.
  useRefetchOnFocus(async () => {
    try {
      const items = await getCollectionItems(collection.id);
      setProducts(items);
    } catch {
      // Quiet failures here just mean the background refresh didn't
      // happen - the visible list stays whatever it already was,
      // rather than surfacing an error for something the user didn't
      // explicitly ask for.
    }
  });

  useRefetchOnFocus(async () => {
    try {
      const items = await getLooksForCollection(collection.id);
      setLooks(items);
      // Keeps an already-open Look Studio view in sync too - covers
      // saving an illustration (or an arrangement) via another tab
      // while this one sat open on the same Look in the background.
      setSelectedLook((current) =>
        current ? items.find((look) => look.id === current.id) ?? current : current,
      );
    } catch {
      // Same reasoning as above - fail quietly, keep showing what's
      // already there.
    }
  });

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

  // Presentation + form state lives in CreateLookModal - this just makes
  // the actual Supabase call and mirrors the result into local state,
  // same division of responsibility as handleCreateCollection. A new
  // Look always starts empty (wishitemIds is always []) - selecting it
  // immediately drops the user straight into Look Studio to style it,
  // rather than back onto the Looks grid.
  async function handleCreateLook(name, wishitemIds) {
    try {
      const look = await createLook(collection.id, name, wishitemIds);
      setLooks((current) => [look, ...current]);
      setSelectedLook(look);
      return { success: true };
    } catch {
      return { success: false, error: "Could not create this look. Please try again." };
    }
  }

  // Same shape as useCollections.js's own delete flow: ask first, then
  // filter the removed Look out of local state on success rather than
  // refetching the whole list.
  function handleRequestRemoveLook(look) {
    setRemoveLookError("");
    setLookPendingRemoval(look);
  }

  function handleCancelRemoveLook() {
    if (isRemovingLook) return;
    setLookPendingRemoval(null);
    setRemoveLookError("");
  }

  async function handleConfirmRemoveLook() {
    setIsRemovingLook(true);
    setRemoveLookError("");

    try {
      await deleteLook(lookPendingRemoval.id);
      setLooks((current) =>
        current.filter((look) => look.id !== lookPendingRemoval.id),
      );
      setLookPendingRemoval(null);
    } catch {
      setRemoveLookError("Could not remove this Look. Please try again.");
    } finally {
      setIsRemovingLook(false);
    }
  }

  async function handleSaveLookLayout(positions) {
    try {
      const updatedLook = await updateLookLayout(selectedLook.id, positions);
      setSelectedLook(updatedLook);
      setLooks((current) =>
        current.map((look) => (look.id === updatedLook.id ? updatedLook : look)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Could not save this arrangement. Please try again." };
    }
  }

  // Uploads through wishlist.js (the only place that ever touches
  // Supabase Storage), then mirrors the new cutoutImageUrl into every
  // spot this wishitem currently appears - `products` (this
  // Collection's own piece list, what Look Studio's catalog panel
  // actually renders from - and what Edit Mode's bed reads from too,
  // see LookDetailView's bedPieces), the open Look, and (in case the
  // same piece is in more than one Look in this Collection) every
  // entry in `looks`. Global wishlist state (All Saves) is deliberately
  // left untouched - Prepare Piece only affects this Collection's own
  // views. products was previously missed here, which is exactly why
  // a freshly-prepared cutout wouldn't show up in the catalog (or the
  // bed while actively editing) until a full page reload re-fetched it.
  async function handlePrepareCutoutSaved(wishitemId, blob) {
    try {
      const uploadResult = await uploadPieceCutout(wishitemId, blob);
      if (!uploadResult.success) {
        return { success: false, error: "Could not save this piece. Please try again." };
      }

      const updateResult = await updateWishitemCutoutImage(wishitemId, uploadResult.url);
      if (!updateResult.success) {
        return { success: false, error: "Could not save this piece. Please try again." };
      }

      const { cutoutImageUrl } = updateResult.product;

      function withUpdatedCutout(look) {
        return {
          ...look,
          wishitems: look.wishitems.map((item) =>
            item.id === wishitemId ? { ...item, cutoutImageUrl } : item,
          ),
        };
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === wishitemId ? { ...product, cutoutImageUrl } : product,
        ),
      );
      setSelectedLook((current) => (current ? withUpdatedCutout(current) : current));
      setLooks((current) => current.map(withUpdatedCutout));

      return { success: true };
    } catch {
      return { success: false, error: "Could not save this piece. Please try again." };
    }
  }

  // Saves Illustrate Look's generated result as this Look's one saved
  // illustration (Milestone 3 - zero or one per Look, no history).
  // Mirrors handleSaveLookLayout's own shape: call the data-layer
  // function, mirror the result into both selectedLook and the looks
  // list, return a plain {success, error} the modal can render.
  async function handleSaveIllustration(imageDataUrl) {
    const result = await saveLookIllustration(selectedLook.id, imageDataUrl);

    if (!result.success) {
      return result;
    }

    function withIllustration(look) {
      return look.id === selectedLook.id
        ? { ...look, illustrationUrl: result.illustrationUrl }
        : look;
    }

    setSelectedLook((current) => (current ? withIllustration(current) : current));
    setLooks((current) => current.map(withIllustration));

    return { success: true };
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

  // A Look's own detail replaces this whole view (same drill-down
  // pattern App.jsx uses for CollectionsView -> CollectionDetailView),
  // rather than nesting inside the Pieces/Looks tabs.
  if (selectedLook) {
    return (
      <LookDetailView
        look={selectedLook}
        collectionName={collection.name}
        onBack={() => setSelectedLook(null)}
        collectionPieces={products}
        onSaveLayout={handleSaveLookLayout}
        onPrepareCutout={handlePrepareCutoutSaved}
        onSaveIllustration={handleSaveIllustration}
      />
    );
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
        <div className="collection-detail__looks">
          {isLooksLoading && (
            <p className="collection-detail__status">Loading...</p>
          )}

          {!isLooksLoading && looks.length > 0 && (
            <>
              <div className="looks-header">
                <p className="looks-header__title">planned looks ♡</p>

                <button
                  type="button"
                  className="collection-detail__create-look"
                  onClick={() => setIsCreateLookModalOpen(true)}
                >
                  + create a look
                </button>
              </div>

              <div className="looks-grid">
                {looks.map((look) => (
                  <LookCard
                    key={look.id}
                    look={look}
                    onClick={() => setSelectedLook(look)}
                    onRequestRemove={handleRequestRemoveLook}
                  />
                ))}
              </div>
            </>
          )}

          {!isLooksLoading && looks.length === 0 && (
            <div className="collection-detail__looks-empty">
              <p className="collection-detail__looks-heart">♡</p>
              <p className="collection-detail__looks-title">no looks planned yet</p>
              <p className="collection-detail__looks-subtitle">
                start putting together outfits
                <br />
                for {collection.name}
              </p>
              <button
                type="button"
                className="collection-detail__create-look"
                onClick={() => setIsCreateLookModalOpen(true)}
              >
                + create a look
              </button>
            </div>
          )}
        </div>
      )}

      {isCreateLookModalOpen && (
        <CreateLookModal
          onClose={() => setIsCreateLookModalOpen(false)}
          onCreate={handleCreateLook}
        />
      )}

      {lookPendingRemoval && (
        <DeleteLookModal
          lookName={lookPendingRemoval.name}
          collectionName={collection.name}
          isSubmitting={isRemovingLook}
          errorMessage={removeLookError}
          onCancel={handleCancelRemoveLook}
          onConfirm={handleConfirmRemoveLook}
        />
      )}
    </div>
  );
}

export default CollectionDetailView;
