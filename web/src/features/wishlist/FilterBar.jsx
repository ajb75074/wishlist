import { useState } from "react";
import { CATEGORIES } from "../../lib/categorize";
import { basicColor } from "../../lib/basicColor";
import "./FilterBar.css";

// Three decreasing bars - the standard "filter" glyph.
function FilterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" fill="currentColor" />
      <rect x="3" y="7" width="10" height="2" fill="currentColor" />
      <rect x="5" y="12" width="6" height="2" fill="currentColor" />
    </svg>
  );
}

// Reads available store/color options straight from the current
// products so the dropdowns never offer a choice with zero matches.
function FilterBar({
  products,
  category,
  onCategoryChange,
  store,
  onStoreChange,
  color,
  onColorChange,
  sortOrder,
  onSortChange,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const stores = [...new Set(products.map((product) => product.store).filter(Boolean))].sort();
  const colors = [...new Set(products.map((product) => basicColor(product.color)).filter(Boolean))].sort();

  return (
    <div className="filter-bar">
      <button
        type="button"
        className={`filter-bar__toggle ${isOpen ? "filter-bar__toggle--open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Hide filters" : "Show filters"}
        title={isOpen ? "Hide filters" : "Show filters"}
      >
        <FilterIcon />
      </button>

      {isOpen && (
        <div className="filter-bar__controls">
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
              <option value="All">All</option>
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Store</span>
            <select value={store} onChange={(event) => onStoreChange(event.target.value)}>
              <option value="All">All</option>
              {stores.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Color</span>
            <select value={color} onChange={(event) => onColorChange(event.target.value)}>
              <option value="All">All</option>
              {colors.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Sort</span>
            <select value={sortOrder} onChange={(event) => onSortChange(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="price-asc">Price: Low to High</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export default FilterBar;
