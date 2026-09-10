import { useEffect, useMemo, useRef, useState } from "react";
import { useEscapeKey } from "../../lib/useEscapeKey";
import { CATEGORIES } from "../../lib/categorize";
import { basicColor, BASIC_COLOR_SWATCHES } from "../../lib/basicColor";
import { PRICE_RANGES } from "../../lib/priceRanges";
import "./FilterPopover.css";

const STORE_PREVIEW_COUNT = 5;

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterPopover({
  id,
  products,
  categories,
  stores,
  color,
  priceRanges,
  sortOrder,
  onApply,
  onClearAll,
  onClose,
  triggerRef,
}) {
  const [draftCategories, setDraftCategories] = useState(categories);
  const [draftStores, setDraftStores] = useState(stores);
  const [draftColor, setDraftColor] = useState(color);
  const [draftPriceRanges, setDraftPriceRanges] = useState(priceRanges);
  const [draftSort, setDraftSort] = useState(sortOrder);
  const [showAllStores, setShowAllStores] = useState(false);

  const panelRef = useRef(null);

  // products doesn't change while the popover is open, but every draft
  // checkbox toggle re-renders this component - memoized so that
  // doesn't re-derive these on every click.
  const availableStores = useMemo(
    () => [...new Set(products.map((p) => p.store).filter(Boolean))].sort(),
    [products],
  );
  const availableColors = useMemo(
    () => [...new Set(products.map((p) => basicColor(p.color)).filter(Boolean))].sort(),
    [products],
  );
  const visibleStores = showAllStores ? availableStores : availableStores.slice(0, STORE_PREVIEW_COUNT);

  useEscapeKey(onClose);

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current?.contains(event.target)) return;
      // The Filter button toggles open/closed on its own click; if this
      // handler also closed on a mousedown there, the very next click
      // event would immediately toggle it back open.
      if (triggerRef?.current?.contains(event.target)) return;

      onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, triggerRef]);

  function handleApply() {
    onApply({
      categories: draftCategories,
      stores: draftStores,
      color: draftColor,
      priceRanges: draftPriceRanges,
      sortOrder: draftSort,
    });
    onClose();
  }

  function handleClearAll() {
    setDraftCategories([]);
    setDraftStores([]);
    setDraftColor("All");
    setDraftPriceRanges([]);
    onClearAll();
  }

  return (
    <div
      id={id}
      className="filter-popover"
      ref={panelRef}
      role="dialog"
      aria-label="Filter"
    >
      <div className="filter-popover__header">
        <h2>Filter</h2>
        <button type="button" onClick={onClose} aria-label="Close filter">
          ×
        </button>
      </div>

      <div className="filter-popover__scroll">
        <section className="filter-popover__section">
          <h3>Category</h3>
          <div className="filter-popover__checklist">
            {CATEGORIES.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={draftCategories.includes(option)}
                  onChange={() => setDraftCategories((current) => toggleValue(current, option))}
                />
                {option}
              </label>
            ))}
          </div>
        </section>

        {availableStores.length > 0 && (
          <section className="filter-popover__section">
            <h3>Store</h3>
            <div className="filter-popover__checklist">
              {visibleStores.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={draftStores.includes(option)}
                    onChange={() => setDraftStores((current) => toggleValue(current, option))}
                  />
                  {option}
                </label>
              ))}
            </div>

            {availableStores.length > STORE_PREVIEW_COUNT && (
              <button
                type="button"
                className="filter-popover__show-more"
                onClick={() => setShowAllStores((current) => !current)}
              >
                {showAllStores ? "Show less" : "Show more"}
              </button>
            )}
          </section>
        )}

        {availableColors.length > 0 && (
          <section className="filter-popover__section">
            <h3>Color</h3>
            <div className="filter-popover__swatches">
              {availableColors.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`filter-popover__swatch ${draftColor === option ? "is-selected" : ""}`}
                  style={{ background: BASIC_COLOR_SWATCHES[option] }}
                  title={option}
                  aria-label={option}
                  aria-pressed={draftColor === option}
                  onClick={() => setDraftColor((current) => (current === option ? "All" : option))}
                />
              ))}
            </div>
          </section>
        )}

        <section className="filter-popover__section">
          <h3>Price</h3>
          <div className="filter-popover__checklist">
            {PRICE_RANGES.map((range) => (
              <label key={range.key}>
                <input
                  type="checkbox"
                  checked={draftPriceRanges.includes(range.key)}
                  onChange={() => setDraftPriceRanges((current) => toggleValue(current, range.key))}
                />
                {range.label}
              </label>
            ))}
          </div>
        </section>

        <section className="filter-popover__section filter-popover__section--sort">
          <h3>Sort</h3>
          <select value={draftSort} onChange={(event) => setDraftSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
          </select>
        </section>
      </div>

      <div className="filter-popover__footer">
        <button type="button" className="filter-popover__clear" onClick={handleClearAll}>
          Clear all
        </button>

        <button type="button" className="filter-popover__apply" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

export default FilterPopover;
