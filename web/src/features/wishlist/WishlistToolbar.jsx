import { useRef, useState } from "react";
import SelectModeBar from "../../components/SelectModeBar";
import FilterPopover from "./FilterPopover";
import bowIcon from "../../assets/bow2.png";
import "./WishlistToolbar.css";

function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" fill="currentColor" />
      <rect x="3" y="7" width="10" height="2" fill="currentColor" />
      <rect x="5" y="12" width="6" height="2" fill="currentColor" />
    </svg>
  );
}

function WishlistToolbar({
  ownership,
  onOwnershipChange,
  isSelectMode,
  onAddItem,
  selectMode,
  hasAnyProducts,
  resultCount,
  products,
  filters,
  onApplyFilters,
  onClearFilters,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef(null);

  const activeFilterGroupCount = [
    filters.categories.length > 0,
    filters.stores.length > 0,
    filters.color !== "All",
    filters.priceRanges.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="wishlist-toolbar">
      <nav className="wishlist-toolbar__tabs" aria-label="Ownership view">
        <button
          type="button"
          className={ownership === "saved" ? "is-active" : ""}
          aria-pressed={ownership === "saved"}
          onClick={() => onOwnershipChange("saved")}
        >
          saved
        </button>
        <button
          type="button"
          className={ownership === "owned" ? "is-active" : ""}
          aria-pressed={ownership === "owned"}
          onClick={() => onOwnershipChange("owned")}
        >
          owned
        </button>
      </nav>

      <div className="wishlist-toolbar__accent">
        <img src={bowIcon} alt="" aria-hidden="true" />
      </div>

      <div className="wishlist-toolbar__actions">
        {!isSelectMode && (
          <button type="button" className="wishlist-toolbar__add" onClick={onAddItem}>
            + Add Item
          </button>
        )}

        {hasAnyProducts && (
          <div className="wishlist-toolbar__management">
            {!isSelectMode && (
              <div className="wishlist-toolbar__filter-anchor">
                <button
                  type="button"
                  ref={filterButtonRef}
                  className={`wishlist-toolbar__filter ${isFilterOpen ? "is-open" : ""}`}
                  aria-expanded={isFilterOpen}
                  aria-controls="wishlist-filter-popover"
                  onClick={() => setIsFilterOpen((open) => !open)}
                >
                  <FilterIcon />
                  Filter{activeFilterGroupCount > 0 ? ` (${activeFilterGroupCount})` : ""}
                </button>

                {isFilterOpen && (
                  <FilterPopover
                    id="wishlist-filter-popover"
                    products={products}
                    categories={filters.categories}
                    stores={filters.stores}
                    color={filters.color}
                    priceRanges={filters.priceRanges}
                    sortOrder={filters.sortOrder}
                    onApply={onApplyFilters}
                    onClearAll={onClearFilters}
                    onClose={() => setIsFilterOpen(false)}
                    triggerRef={filterButtonRef}
                  />
                )}
              </div>
            )}

            <SelectModeBar
              isActive={selectMode.isActive}
              selectedCount={selectMode.selectedCount}
              onEnter={selectMode.onEnter}
              onCancel={selectMode.onCancel}
            />
          </div>
        )}
      </div>

      {hasAnyProducts && (
        <div className="wishlist-toolbar__count-row">
          <span className="wishlist-toolbar__count">
            {resultCount} {resultCount === 1 ? "piece" : "pieces"}
          </span>
        </div>
      )}
    </div>
  );
}

export default WishlistToolbar;
