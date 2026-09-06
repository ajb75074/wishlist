import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import ProductGrid from "./features/wishlist/ProductGrid";
import FilterBar from "./features/wishlist/FilterBar";
import DonateConfirmModal from "./features/wishlist/DonateConfirmModal";
import { useWishlist } from "./features/wishlist/useWishlist";
import Header from "./components/header/Header";
import { categorizeProduct } from "./lib/categorize";
import { basicColor } from "./lib/basicColor";
import Sidebar from "./components/sidebar/Sidebar";
import CreateCollectionModal from "./features/collections/CreateCollectionModal";
import EditCollectionModal from "./features/collections/EditCollectionModal";
import CollectionsView from "./features/collections/CollectionsView";
import CollectionRoute from "./features/collections/CollectionRoute";
import CollectionSavePopover from "./features/collections/CollectionSavePopover";
import DeleteCollectionModal from "./features/collections/DeleteCollectionModal";
import { useCollections } from "./features/collections/useCollections";
import SelectModeBar from "./components/SelectModeBar";
import ActionTray from "./components/ActionTray";
import ProfileView from "./features/profile/ProfileView";
import AddItemModal from "./features/wishlist/AddItemModal";

function App() {
  const { products, loading, error, updatingId, performDelete, handleUpdate, handleCreate } = useWishlist();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedColor, setSelectedColor] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  // All Saves' own Saved/Owned view - presentation only, never sent to
  // Supabase and never touched by Collections/Looks, which keep
  // reading every wishitem regardless of ownership. Saved-first is the
  // product decision, so this is the default and the only two values -
  // no "all" option unless a concrete need for one shows up later.
  const [ownership, setOwnership] = useState("saved");
  // { product, anchorEl, rect } | null - which product's save popover is open
  const [savePopover, setSavePopover] = useState(null);
  // All Saves Select Mode - a separate, opt-in management state so
  // Browse Mode cards stay clean by default.
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  // Trigger for opening a specific card's existing edit mode from the
  // Select Mode action tray. autoEditKey changes on every click (even
  // for the same product) so ProductCard's effect always re-fires.
  const [autoEditProductId, setAutoEditProductId] = useState(null);
  const [autoEditKey, setAutoEditKey] = useState(0);
  // Donate confirmation - opened from the Select Mode action tray.
  // App only renders the modal while this is true, so it always mounts
  // fresh (see DonateConfirmModal's own comment on that pattern).
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  const [isDonating, setIsDonating] = useState(false);
  const [donateError, setDonateError] = useState("");

  // The current collection (if any) is derived from the URL rather than
  // kept as its own state - /collections/:collectionName is the single
  // source of truth for which one is open, so the Sidebar's own
  // highlight and the "collection just got deleted" check below both
  // read off this instead of a parallel piece of state that could drift
  // from the URL.
  const collectionNameParam = decodeURIComponent(
    location.pathname.match(/^\/collections\/([^/]+)/)?.[1] ?? "",
  ) || null;

  const {
    collections,
    isLoadingCollections,
    handleCreateCollection,
    editingCollection,
    handleRequestEditCollection,
    handleCancelEditCollection,
    handleUpdateCollection,
    collectionPendingDelete,
    isDeletingCollection,
    deleteCollectionError,
    handleRequestDeleteCollection,
    handleCancelDeleteCollection,
    handleConfirmDeleteCollection,
  } = useCollections({
    // If the collection we're currently viewing gets deleted, back out
    // to the collections grid instead of leaving a dead detail view up.
    onCollectionDeleted: (deletedId) => {
      if (currentCollection?.id === deletedId) {
        navigate("/collections");
      }
    },
  });

  const currentCollection = collectionNameParam
    ? collections.find((c) => c.name.toLowerCase() === collectionNameParam.toLowerCase())
    : null;

  // Drilling into a specific collection also makes the broader
  // "Collections" nav section read as active, regardless of whether
  // this was triggered from CollectionsView or the Sidebar list.
  function handleSelectCollection(collection) {
    navigate(`/collections/${encodeURIComponent(collection.name)}`);
  }

  // Any top-level nav change resets the drill-down, so re-clicking
  // "Collections" itself returns to the general grid rather than
  // staying on whichever collection was last open.
  function handleViewChange(view) {
    navigate(view === "all" ? "/" : "/collections");
  }

  // Clicking the trigger again toggles the same popover closed instead
  // of just re-measuring/reopening it; clicking a different card's
  // trigger while one is open moves the popover to that product.
  function handleToggleSavePopover(product, anchorEl) {
    setSavePopover((current) => {
      if (current?.product.id === product.id) {
        return null;
      }

      return { product, anchorEl, rect: anchorEl.getBoundingClientRect() };
    });
  }

  function handleCloseSavePopover() {
    setSavePopover(null);
  }

  function handleEnterSelectMode() {
    setIsSelectMode(true);
    setSelectedProductIds(new Set());
  }

  function handleCancelSelectMode() {
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
  }

  // A selected item can be hidden by the new ownership view the moment
  // it changes (its id would linger in selectedProductIds pointing at
  // a card that's no longer rendered) - clearing the selection here is
  // the smallest safe fix, without leaving/re-entering Select Mode
  // itself. A no-op guard avoids clearing an in-progress selection for
  // a click that didn't actually change anything.
  function handleOwnershipChange(nextOwnership) {
    if (nextOwnership === ownership) return;
    setOwnership(nextOwnership);
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

  // Only offered when exactly one item is selected. Exits Select Mode
  // and hands off to that card's own existing edit UI (Save/Cancel work
  // exactly as they already do) instead of building a second editor.
  function handleEditFromSelectMode() {
    const [onlyId] = selectedProductIds;

    setAutoEditProductId(onlyId);
    setAutoEditKey((key) => key + 1);
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
  }

  function handleOpenDonateModal() {
    setDonateError("");
    setIsDonateModalOpen(true);
  }

  function handleCloseDonateModal() {
    if (isDonating) return;
    setIsDonateModalOpen(false);
    setDonateError("");
  }

  // Donate ♡ is the fashion-themed rename for the same global delete -
  // this modal is the confirmation, so it calls performDelete directly
  // rather than popping a second, redundant confirm on top of itself.
  async function handleConfirmDonate() {
    setIsDonating(true);
    setDonateError("");

    const ids = Array.from(selectedProductIds);
    let allSucceeded = true;

    for (const id of ids) {
      const result = await performDelete(id);
      if (!result.success) {
        allSucceeded = false;
      }
    }

    setIsDonating(false);

    if (allSucceeded) {
      setIsDonateModalOpen(false);
      setIsSelectMode(false);
      setSelectedProductIds(new Set());
    } else {
      setDonateError("Could not donate all selected pieces. Please try again.");
    }
  }

  // Presentation-only split of the SAME wishlist state useWishlist
  // already owns - nothing is removed/mutated, a product just moves
  // in or out of this derived list as `ownership` or the product's own
  // isOwned changes. !product.isOwned (rather than === false) is
  // deliberate: any pre-feature/defensive row without a real isOwned
  // value already normalizes to false at the data layer, and this
  // stays correct even if that ever isn't the case.
  const ownershipFilteredProducts = products.filter((product) =>
    ownership === "saved" ? !product.isOwned : product.isOwned,
  );

  const query = searchTerm.trim().toLowerCase();

  let filteredProducts = query
    ? ownershipFilteredProducts.filter((product) =>
      [product.name, product.store, product.color].some((field) =>
        field?.toLowerCase().includes(query),
      ),
    )
    : ownershipFilteredProducts;

  if (selectedCategory !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => categorizeProduct(product) === selectedCategory,
    );
  }

  if (selectedStore !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => product.store === selectedStore,
    );
  }

  if (selectedColor !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => basicColor(product.color) === selectedColor,
    );
  }

  if (sortOrder === "price-desc") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    );
  } else if (sortOrder === "price-asc") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
    );
  }

  return (
    <div className="app-layout">

      <Sidebar
        activeView={location.pathname.startsWith("/collections") ? "collections" : "all"}
        onViewChange={handleViewChange}
        collections={collections}
        onCreateCollection={() => setIsCreateModalOpen(true)}
        onSelectCollection={handleSelectCollection}
        selectedCollectionId={currentCollection?.id}
      />

      <div className="app-content">

        {/* The collection detail page has its own heading (thumbnail +
            name), so the generic app Header would just be a redundant
            "Collections" banner on top of it - only shown on the
            collections grid itself. */}
        {location.pathname === "/collections" && (
          <Header
            title="Collections"
            tagline="your saved pieces, grouped by vibe, trip, and moment ♡"
            showSearch={false}
            showNote={false}
          />
        )}

        {location.pathname === "/" && (
          <Header
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}

        {loading && <p>Loading...</p>}

        {error && <p>{error}</p>}

        <Routes>
          <Route
            path="/"
            element={
              <>
            {!loading && !error && (
              <div className="toolbar-row">
                {/* Always visible (even with zero items in the current
                    view, and even in Select Mode) - unlike + Add Item/
                    SelectModeBar/FilterBar below, switching views needs
                    to work from an empty view too, and a selection made
                    before switching still needs a way to be cleared. */}
                <div className="ownership-toggle" role="group" aria-label="Ownership view">
                  <button
                    type="button"
                    className={`ownership-toggle__btn${ownership === "saved" ? " is-active" : ""}`}
                    aria-pressed={ownership === "saved"}
                    onClick={() => handleOwnershipChange("saved")}
                  >
                    saved
                  </button>
                  <button
                    type="button"
                    className={`ownership-toggle__btn${ownership === "owned" ? " is-active" : ""}`}
                    aria-pressed={ownership === "owned"}
                    onClick={() => handleOwnershipChange("owned")}
                  >
                    owned
                  </button>
                </div>

                {/* Phase 3's one entry point for manual item creation -
                    visible with zero items in the current view too
                    (unlike SelectModeBar/FilterBar below, which need
                    existing products), hidden during Select Mode
                    alongside FilterBar so it doesn't compete with the
                    bulk-action bar. */}
                {!isSelectMode && (
                  <button
                    type="button"
                    className="add-item-button"
                    onClick={() => setIsAddItemModalOpen(true)}
                  >
                    + add item
                  </button>
                )}

                {ownershipFilteredProducts.length > 0 && (
                  <>
                    <SelectModeBar
                      isActive={isSelectMode}
                      selectedCount={selectedProductIds.size}
                      onEnter={handleEnterSelectMode}
                      onCancel={handleCancelSelectMode}
                    />

                    {!isSelectMode && (
                      <FilterBar
                        products={ownershipFilteredProducts}
                        category={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        store={selectedStore}
                        onStoreChange={setSelectedStore}
                        color={selectedColor}
                        onColorChange={setSelectedColor}
                        sortOrder={sortOrder}
                        onSortChange={setSortOrder}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {!loading && !error && ownershipFilteredProducts.length === 0 && (
              <p>{ownership === "saved" ? "No saved items yet." : "No owned items yet."}</p>
            )}

            {!loading &&
              !error &&
              ownershipFilteredProducts.length > 0 &&
              filteredProducts.length === 0 && (
                <p>No items match your filters.</p>
              )}

            {!loading && !error && filteredProducts.length > 0 && (
              <ProductGrid
                products={filteredProducts}
                onUpdate={handleUpdate}
                updatingId={updatingId}
                onAddToCollection={handleToggleSavePopover}
                isSelectMode={isSelectMode}
                selectedProductIds={selectedProductIds}
                onToggleSelect={handleToggleProductSelected}
                autoEditProductId={autoEditProductId}
                autoEditKey={autoEditKey}
              />
            )}

            {isSelectMode && selectedProductIds.size > 0 && (
              <ActionTray>
                {selectedProductIds.size === 1 && (
                  <button
                    type="button"
                    className="action-tray__button"
                    onClick={handleEditFromSelectMode}
                  >
                    edit
                  </button>
                )}

                <button
                  type="button"
                  className="action-tray__button action-tray__button--primary"
                  onClick={handleOpenDonateModal}
                >
                  donate ♡
                </button>
              </ActionTray>
            )}

            {isDonateModalOpen && (
              <DonateConfirmModal
                count={selectedProductIds.size}
                isSubmitting={isDonating}
                errorMessage={donateError}
                onCancel={handleCloseDonateModal}
                onConfirm={handleConfirmDonate}
              />
            )}
              </>
            }
          />

          <Route
            path="/collections"
            element={
              <CollectionsView
                collections={collections}
                onCreateCollection={() => setIsCreateModalOpen(true)}
                onSelectCollection={handleSelectCollection}
                onEditCollection={handleRequestEditCollection}
                onDeleteCollection={handleRequestDeleteCollection}
              />
            }
          />

          <Route
            path="/collections/:collectionName"
            element={
              <CollectionRoute
                collections={collections}
                isLoadingCollections={isLoadingCollections}
                onUpdate={handleUpdate}
                updatingId={updatingId}
              />
            }
          />

          <Route
            path="/collections/:collectionName/looks/:lookName"
            element={
              <CollectionRoute
                collections={collections}
                isLoadingCollections={isLoadingCollections}
                onUpdate={handleUpdate}
                updatingId={updatingId}
              />
            }
          />

          <Route path="/profile" element={<ProfileView />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>

      {isCreateModalOpen && (
        <CreateCollectionModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateCollection}
        />
      )}

      {isAddItemModalOpen && (
        <AddItemModal
          onClose={() => setIsAddItemModalOpen(false)}
          onCreated={handleCreate}
        />
      )}

      {editingCollection && (
        <EditCollectionModal
          collection={editingCollection}
          onClose={handleCancelEditCollection}
          onSave={handleUpdateCollection}
        />
      )}

      {collectionPendingDelete && (
        <DeleteCollectionModal
          collectionName={collectionPendingDelete.name}
          isSubmitting={isDeletingCollection}
          errorMessage={deleteCollectionError}
          onCancel={handleCancelDeleteCollection}
          onConfirm={handleConfirmDeleteCollection}
        />
      )}

      {savePopover && (
        <CollectionSavePopover
          product={savePopover.product}
          anchorRect={savePopover.rect}
          anchorEl={savePopover.anchorEl}
          collections={collections}
          onClose={handleCloseSavePopover}
          onCreateCollection={() => setIsCreateModalOpen(true)}
        />
      )}

    </div>
  );
}

export default App;
