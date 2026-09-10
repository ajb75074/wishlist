import { useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import NotFoundView from "./components/NotFoundView";
import ProductGrid from "./features/wishlist/ProductGrid";
import WishlistHero from "./features/wishlist/WishlistHero";
import WishlistToolbar from "./features/wishlist/WishlistToolbar";
import DonateConfirmModal from "./features/wishlist/DonateConfirmModal";
import { useWishlist } from "./features/wishlist/useWishlist";
import Header from "./components/header/Header";
import { categorizeProduct } from "./lib/categorize";
import { basicColor } from "./lib/basicColor";
import { priceMatchesRanges } from "./lib/priceRanges";
import Sidebar from "./components/sidebar/Sidebar";
import Footer from "./components/Footer";
import CreateCollectionModal from "./features/collections/CreateCollectionModal";
import EditCollectionModal from "./features/collections/EditCollectionModal";
import CollectionsView from "./features/collections/CollectionsView";
import CollectionRoute from "./features/collections/CollectionRoute";
import CollectionSavePopover from "./features/collections/CollectionSavePopover";
import DeleteCollectionModal from "./features/collections/DeleteCollectionModal";
import { useCollections } from "./features/collections/useCollections";
import ActionTray from "./components/ActionTray";
import ProfileView from "./features/profile/ProfileView";
import AddItemModal from "./features/wishlist/AddItemModal";

function App() {
  const { products, loading, error, updatingId, performDelete, handleUpdate, handleCreate } = useWishlist();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  // Arrays: Category/Store allow multiple selections; empty means no filter.
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedColor, setSelectedColor] = useState("All");
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCollectionPrefillName, setCreateCollectionPrefillName] = useState("");
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [ownership, setOwnership] = useState("saved");
  // { product, anchorEl, rect } | null - which product's save popover is open
  const [savePopover, setSavePopover] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  // Trigger for opening a specific card's existing edit mode from the
  // Select Mode action tray. autoEditKey changes on every click (even
  // for the same product) so ProductCard's effect always re-fires.
  const [autoEditProductId, setAutoEditProductId] = useState(null);
  const [autoEditKey, setAutoEditKey] = useState(0);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  const [isDonating, setIsDonating] = useState(false);
  const [donateError, setDonateError] = useState("");

  // Derived from the URL, not state - /collections/:collectionName is the
  // single source of truth for which collection is open.
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

  function handleSelectCollection(collection) {
    navigate(`/collections/${encodeURIComponent(collection.name)}`);
  }

  function handleViewChange(view) {
    navigate(view === "all" ? "/" : "/collections");
  }

  // Often wired straight to a button's onClick, so the first argument may be
  // a click event rather than a name.
  function handleOpenCreateModal(prefillName) {
    setCreateCollectionPrefillName(typeof prefillName === "string" ? prefillName : "");
    setIsCreateModalOpen(true);
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

  function handleApplyFilters(next) {
    setSelectedCategories(next.categories);
    setSelectedStores(next.stores);
    setSelectedColor(next.color);
    setSelectedPriceRanges(next.priceRanges);
    setSortOrder(next.sortOrder);
  }

  function handleClearFilters() {
    setSelectedCategories([]);
    setSelectedStores([]);
    setSelectedColor("All");
    setSelectedPriceRanges([]);
  }

  // Clear the selection when the ownership view changes - selected ids could
  // otherwise point at cards that are no longer rendered.
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
      setDonateError("Could not donate all selected items. Please try again.");
    }
  }

  // !isOwned (not === false) stays correct for rows where isOwned isn't a
  // real boolean.
  const ownershipFilteredProducts = useMemo(
    () => products.filter((product) => (ownership === "saved" ? !product.isOwned : product.isOwned)),
    [products, ownership],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    let result = query
      ? ownershipFilteredProducts.filter((product) =>
        [product.name, product.store, product.color].some((field) =>
          field?.toLowerCase().includes(query),
        ),
      )
      : ownershipFilteredProducts;

    if (selectedCategories.length > 0) {
      result = result.filter((product) => selectedCategories.includes(categorizeProduct(product)));
    }

    if (selectedStores.length > 0) {
      result = result.filter((product) => selectedStores.includes(product.store));
    }

    if (selectedColor !== "All") {
      result = result.filter((product) => basicColor(product.color) === selectedColor);
    }

    if (selectedPriceRanges.length > 0) {
      result = result.filter((product) => priceMatchesRanges(product.price, selectedPriceRanges));
    }

    if (sortOrder === "price-desc") {
      result = [...result].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortOrder === "price-asc") {
      result = [...result].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }

    return result;
  }, [
    ownershipFilteredProducts,
    searchTerm,
    selectedCategories,
    selectedStores,
    selectedColor,
    selectedPriceRanges,
    sortOrder,
  ]);

  return (
    <div className="app-layout">

      <Sidebar
        activeView={location.pathname.startsWith("/collections") ? "collections" : "all"}
        onViewChange={handleViewChange}
        collections={collections}
        onCreateCollection={handleOpenCreateModal}
        onSelectCollection={handleSelectCollection}
        selectedCollectionId={currentCollection?.id}
      />

      <div className="app-content">
        <div className="app-content__main">

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
          <WishlistHero
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
              <WishlistToolbar
                ownership={ownership}
                onOwnershipChange={handleOwnershipChange}
                isSelectMode={isSelectMode}
                onAddItem={() => setIsAddItemModalOpen(true)}
                selectMode={{
                  isActive: isSelectMode,
                  selectedCount: selectedProductIds.size,
                  onEnter: handleEnterSelectMode,
                  onCancel: handleCancelSelectMode,
                }}
                hasAnyProducts={ownershipFilteredProducts.length > 0}
                resultCount={filteredProducts.length}
                products={ownershipFilteredProducts}
                filters={{
                  categories: selectedCategories,
                  stores: selectedStores,
                  color: selectedColor,
                  priceRanges: selectedPriceRanges,
                  sortOrder,
                }}
                onApplyFilters={handleApplyFilters}
                onClearFilters={handleClearFilters}
              />
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
                  donate
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
                onCreateCollection={handleOpenCreateModal}
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

          <Route path="*" element={<NotFoundView />} />
        </Routes>

        </div>

        <Footer />

      </div>

      {isCreateModalOpen && (
        <CreateCollectionModal
          initialName={createCollectionPrefillName}
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
          onCreateCollection={handleOpenCreateModal}
        />
      )}

    </div>
  );
}

export default App;
