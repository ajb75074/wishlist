import { useState } from "react";
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
import CollectionsView from "./features/collections/CollectionsView";
import CollectionDetailView from "./features/collections/CollectionDetailView";
import CollectionSavePopover from "./features/collections/CollectionSavePopover";
import DeleteCollectionModal from "./features/collections/DeleteCollectionModal";
import { useCollections } from "./features/collections/useCollections";
import SelectModeBar from "./components/SelectModeBar";
import ActionTray from "./components/ActionTray";

function App() {
  const { products, loading, error, updatingId, performDelete, handleUpdate } = useWishlist();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedColor, setSelectedColor] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [activeView, setActiveView] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
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

  const {
    collections,
    handleCreateCollection,
    collectionPendingDelete,
    isDeletingCollection,
    deleteCollectionError,
    handleRequestDeleteCollection,
    handleCancelDeleteCollection,
    handleConfirmDeleteCollection,
  } = useCollections({
    // If the collection we're currently viewing gets deleted, back out
    // to the collections grid instead of leaving a dead detail view up.
    onCollectionDeleted: (deletedId) =>
      setSelectedCollection((current) => (current?.id === deletedId ? null : current)),
  });

  // Drilling into a specific collection also makes the broader
  // "Collections" nav section read as active, regardless of whether
  // this was triggered from CollectionsView or the Sidebar list.
  function handleSelectCollection(collection) {
    setActiveView("collections");
    setSelectedCollection(collection);
  }

  // Any top-level nav change resets the drill-down, so re-clicking
  // "Collections" itself returns to the general grid rather than
  // staying on whichever collection was last open.
  function handleViewChange(view) {
    setActiveView(view);
    setSelectedCollection(null);
  }

  function handleBackToCollections() {
    setSelectedCollection(null);
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

  const query = searchTerm.trim().toLowerCase();

  let filteredProducts = query
    ? products.filter((product) =>
      [product.name, product.store, product.color].some((field) =>
        field?.toLowerCase().includes(query),
      ),
    )
    : products;

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
        activeView={activeView}
        onViewChange={handleViewChange}
        collections={collections}
        onCreateCollection={() => setIsCreateModalOpen(true)}
        onSelectCollection={handleSelectCollection}
        selectedCollectionId={selectedCollection?.id}
      />

      <div className="app-content">

        {/* The collection detail page has its own heading (thumbnail +
            name), so the generic app Header would just be a redundant
            "Collections" banner on top of it - only shown on the
            collections grid itself. */}
        {activeView === "collections" && !selectedCollection && (
          <Header
            title="Collections"
            tagline="your saved pieces, grouped by vibe, trip, and moment ♡"
            showSearch={false}
            showNote={false}
          />
        )}

        {activeView !== "collections" && (
          <Header
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}

        {loading && <p>Loading...</p>}

        {error && <p>{error}</p>}

        {activeView === "all" && (
          <>
            {!loading && !error && products.length === 0 && (
              <p>No saved items yet.</p>
            )}

            {!loading && !error && products.length > 0 && (
              <div className="toolbar-row">
                <SelectModeBar
                  isActive={isSelectMode}
                  selectedCount={selectedProductIds.size}
                  onEnter={handleEnterSelectMode}
                  onCancel={handleCancelSelectMode}
                />

                {!isSelectMode && (
                  <FilterBar
                    products={products}
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
              </div>
            )}

            {!loading &&
              !error &&
              products.length > 0 &&
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
        )}

        {activeView === "collections" && selectedCollection && (
          <CollectionDetailView
            collection={selectedCollection}
            onBack={handleBackToCollections}
            onUpdate={handleUpdate}
            updatingId={updatingId}
          />
        )}

        {activeView === "collections" && !selectedCollection && (
          <CollectionsView
            collections={collections}
            onCreateCollection={() => setIsCreateModalOpen(true)}
            onSelectCollection={handleSelectCollection}
            onDeleteCollection={handleRequestDeleteCollection}
          />
        )}

      </div>

      {isCreateModalOpen && (
        <CreateCollectionModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateCollection}
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
