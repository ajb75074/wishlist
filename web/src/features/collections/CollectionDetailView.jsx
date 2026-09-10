import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
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

function CollectionDetailView({
  collection,
  onUpdate,
  updatingId,
}) {
  const navigate = useNavigate();
  // Only present on the nested /looks/:lookName route - that's how "Look
  // Studio is open" is detected.
  const { lookName } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const successTimeoutRef = useRef(null);
  const [activeTab, setActiveTab] = useState("pieces");
  const [looks, setLooks] = useState([]);
  const [isLooksLoading, setIsLooksLoading] = useState(true);
  const [isCreateLookModalOpen, setIsCreateLookModalOpen] = useState(false);
  const [lookPendingRemoval, setLookPendingRemoval] = useState(null);
  const [isRemovingLook, setIsRemovingLook] = useState(false);
  const [removeLookError, setRemoveLookError] = useState("");

  // Reset select state when the collection changes, since this view never
  // unmounts between collections.
  const [lastCollectionId, setLastCollectionId] = useState(collection.id);
  if (collection.id !== lastCollectionId) {
    setLastCollectionId(collection.id);
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
    setRemoveError("");
    setSuccessMessage("");
    setActiveTab("pieces");
  }

  // Derived from the URL plus the loaded looks list, so a direct link or
  // refresh into Look Studio resolves correctly.
  const selectedLook = lookName
    ? looks.find((look) => look.name.toLowerCase() === lookName.toLowerCase()) ?? null
    : null;

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

  // Silent background refetch on tab focus - covers a save from another
  // tab or the extension. No loading state toggled: should feel like
  // the data was already there, not a reload.
  useRefetchOnFocus(async () => {
    try {
      const items = await getCollectionItems(collection.id);
      setProducts(items);
    } catch {
      // Fail quietly - keep showing whatever was already there.
    }
  });

  useRefetchOnFocus(async () => {
    try {
      const items = await getLooksForCollection(collection.id);
      setLooks(items);
    } catch {
      // Fail quietly - keep showing whatever was already there.
    }
  });

  async function handleUpdate(id, updates) {
    const result = await onUpdate(id, updates);

    if (result?.success && result.product) {
      setProducts((current) =>
        current.map((product) => (product.id === id ? result.product : product)),
      );
    }

    return result;
  }

  async function handleCreateLook(name, wishitemIds) {
    try {
      const look = await createLook(collection.id, name, wishitemIds);
      setLooks((current) => [look, ...current]);
      navigate(`/collections/${encodeURIComponent(collection.name)}/looks/${encodeURIComponent(look.name)}`);
      return { success: true };
    } catch {
      return { success: false, error: "Could not create this outfit. Please try again." };
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
      setLooks((current) =>
        current.map((look) => (look.id === updatedLook.id ? updatedLook : look)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Could not save this arrangement. Please try again." };
    }
  }

  // Mirror the new cutoutImageUrl into every place this wishitem appears.
  async function handlePrepareCutoutSaved(wishitemId, blob) {
    try {
      const uploadResult = await uploadPieceCutout(wishitemId, blob);
      if (!uploadResult.success) {
        return { success: false, error: "Could not save this item. Please try again." };
      }

      const updateResult = await updateWishitemCutoutImage(wishitemId, uploadResult.url);
      if (!updateResult.success) {
        return { success: false, error: "Could not save this item. Please try again." };
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
      setLooks((current) => current.map(withUpdatedCutout));

      return { success: true };
    } catch {
      return { success: false, error: "Could not save this item. Please try again." };
    }
  }

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

  // Only touches this collection's own collection_items link - the wishlist
  // item itself is untouched.
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

  // lookName present but not yet resolvable while looks load - show loading
  // rather than flashing the tabs.
  if (lookName && isLooksLoading) {
    return <p className="collection-detail__status">Loading...</p>;
  }

  if (lookName && !selectedLook) {
    return <Navigate to={`/collections/${encodeURIComponent(collection.name)}`} replace />;
  }

  if (selectedLook) {
    return (
      <LookDetailView
        look={selectedLook}
        onBack={() => navigate(`/collections/${encodeURIComponent(collection.name)}`)}
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
        onClick={() => navigate("/collections")}
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
          <p>items saved for this collection ♡</p>
        </div>
      </div>

      <div className="collection-tabs">
        <button
          type="button"
          className={`collection-tabs__tab${activeTab === "pieces" ? " is-active" : ""}`}
          onClick={() => setActiveTab("pieces")}
        >
          Items
        </button>
        <button
          type="button"
          className={`collection-tabs__tab${activeTab === "looks" ? " is-active" : ""}`}
          onClick={() => setActiveTab("looks")}
        >
          Outfits
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
                add saved items to this collection to start building the mood
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
                <p className="looks-header__title">Your outfits</p>

                <button
                  type="button"
                  className="collection-detail__create-look"
                  onClick={() => setIsCreateLookModalOpen(true)}
                >
                  + New outfit
                </button>
              </div>

              <div className="looks-grid">
                {looks.map((look) => (
                  <LookCard
                    key={look.id}
                    look={look}
                    onClick={() =>
                      navigate(
                        `/collections/${encodeURIComponent(collection.name)}/looks/${encodeURIComponent(look.name)}`,
                      )
                    }
                    onRequestRemove={handleRequestRemoveLook}
                  />
                ))}
              </div>
            </>
          )}

          {!isLooksLoading && looks.length === 0 && (
            <div className="collection-detail__looks-empty">
              <p className="collection-detail__looks-heart">♡</p>
              <p className="collection-detail__looks-title">no outfits planned yet</p>
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
                + New outfit
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
