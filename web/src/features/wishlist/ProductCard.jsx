import { useEffect, useRef, useState } from "react";
import "./ProductCard.css";

// Simple blocky plus, matching FilterBar's rect-based icon style.
function AddToCollectionIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect x="7" y="1" width="2" height="14" fill="currentColor" />
      <rect x="1" y="7" width="14" height="2" fill="currentColor" />
    </svg>
  );
}

// Pixel-style heart, purely decorative for now (no favorite state/logic yet).
function HeartIcon() {
  return (
    <svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
      <path d="M29.71 2.28h1.53v22.86h-1.53Z" fill="currentColor" />
      <path d="m25.14 31.24 0 -1.53 1.52 0 0 -3.05 3.05 0 0 -1.52 -22.86 0 0 1.52 1.53 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.52 0 0 -1.53 3.05 0 0 1.53 1.53 0 0 -1.53 1.52 0 0 1.53 -1.52 0 0 1.52 -3.05 0 0 -1.52 -1.53 0 0 1.52 -3.04 0 0 -1.52 -1.53 0 0 1.52 -3.04 0 0 -1.52 -1.53 0 0 1.52 -3.05 0 0 -1.52 -1.52 0 0 1.52 -3.05 0 0 1.53 22.86 0z" fill="currentColor" />
      <path d="m12.95 16 1.52 0 0 1.52 1.53 0 0 1.53 1.52 0 0 1.52 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -1.52 1.53 0 0 -1.53 1.52 0 0 -4.57 -1.52 0 0 -1.52 -4.58 0 0 1.52 -1.52 0 0 -1.52 -4.57 0 0 1.52 -1.52 0 0 4.57 1.52 0 0 1.53z" fill="currentColor" />
      <path d="M6.85 0.76h22.86v1.52H6.85Z" fill="currentColor" />
      <path d="M3.81 26.66h1.52v1.53H3.81Z" fill="currentColor" />
      <path d="m3.81 26.66 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.52 -1.53 0 0 -3.05 1.53 0 0 -1.53 1.52 0 0 1.53 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.52 1.52 0 0 3.05 -1.52 0 0 1.53 1.52 0 0 3.04 -1.52 0 0 1.53 1.52 0 0 1.52 1.52 0 0 -22.86 -1.52 0 0 3.05 -3.05 0 0 1.52 -1.52 0 0 22.86 1.52 0 0 -3.05 1.53 0z" fill="currentColor" />
    </svg>
  );
}

function ProductCard({
  product,
  onUpdate,
  isUpdating,
  context = "all",
  onAddToCollection,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  startEditSignal,
}) {
  // Controls whether the overlay is showing inputs instead of text
  const [isEditing, setIsEditing] = useState(false);

  // Stores temporary edit values
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");

  // Focus the color input whenever editing begins, from either trigger
  // below - a real DOM side effect, so this belongs in an effect.
  const colorInputRef = useRef(null);
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => colorInputRef.current?.focus());
    }
  }, [isEditing]);

  // Lets App.jsx's "edit" action-tray button (Select Mode, exactly one
  // item selected) open THIS card's existing edit mode, without lifting
  // isEditing out of the card. startEditSignal changes to a new,
  // distinct value each time the tray button is clicked - even for the
  // same product twice in a row - so this keeps re-triggering correctly.
  // Handled during render (React's sanctioned way to react to a prop
  // change without an effect) rather than in a useEffect, since calling
  // setState synchronously inside an effect body is the exact pattern
  // React's own lint rule flags as a cascading-render risk.
  const [lastEditSignal, setLastEditSignal] = useState(startEditSignal);
  if (startEditSignal && startEditSignal !== lastEditSignal) {
    setLastEditSignal(startEditSignal);
    setColorInput(product.color || "");
    setSizeInput(product.size || "");
    setIsEditing(true);
  }

  // Close inline editing without saving
  function cancelEditing() {
    setIsEditing(false);
  }

  // Save updated color and size
  async function saveEditing() {
    const result = await onUpdate(product.id, {
      color: colorInput.trim() || null,
      size: sizeInput.trim() || null,
    });

    if (result.success) {
      setIsEditing(false);
    }
  }

  return (
    <article className="product-card">
      <div className={`product-card__visual ${isEditing ? "is-editing" : ""}`}>
        {/* Product image */}
        <img
          className="product-card__image"
          src={product.imageUrl}
          alt={product.name}
        />

        {/* Decorative for now, no favorite behavior yet - moved to the
            top-left so it doesn't collide with the save button below */}
        <span className="product-card__favorite">
          <HeartIcon />
        </span>

        {/* Browse Mode only - hidden while editing or selecting so it
            never competes with those other actions */}
        {context === "all" && !isEditing && !isSelectMode && (
          <button
            type="button"
            className="product-card__save"
            onClick={(event) => onAddToCollection(product, event.currentTarget)}
            aria-label="Add to collection"
            title="Add to collection"
          >
            <AddToCollectionIcon />
          </button>
        )}

        {/* Product information shown on hover */}
        <div className="product-card__overlay">
          <div className="product-card__details">
            <h2 className="product-card__name">
              {product.name}
            </h2>

            <p className="product-card__store">
              {product.store}
            </p>

            <p className="product-card__price">
              {product.price
                ? `$${product.price}`
                : "Price unavailable"}
            </p>

            {/* Product metadata, editable in place */}
            <div className="product-card__meta">
              <div>
                <span>COLOR</span>
                {isEditing ? (
                  <input
                    ref={colorInputRef}
                    className="product-card__meta-input"
                    type="text"
                    value={colorInput}
                    onChange={(event) =>
                      setColorInput(event.target.value)
                    }
                    disabled={isUpdating}
                  />
                ) : (
                  <strong>{product.color || "—"}</strong>
                )}
              </div>

              <div>
                <span>SIZE</span>
                {isEditing ? (
                  <input
                    className="product-card__meta-input"
                    type="text"
                    value={sizeInput}
                    onChange={(event) =>
                      setSizeInput(event.target.value)
                    }
                    disabled={isUpdating}
                  />
                ) : (
                  <strong>{product.size || "—"}</strong>
                )}
              </div>
            </div>
          </div>

          {/* Actions appear underneath the product details */}
          <div className="product-card__actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="product-card__action product-card__action--secondary"
                  onClick={cancelEditing}
                  disabled={isUpdating}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="product-card__action product-card__action--primary"
                  onClick={saveEditing}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              // Browse Mode only shows View Item - editing now only
              // happens via the Select Mode action tray's "edit". A
              // manual item may have no link at all (something the
              // user already owns, nothing to view online) - rather
              // than rendering an inert <a> with no href, the action
              // is simply omitted for those items.
              product.productUrl && (
                <a
                  className="product-card__action product-card__action--primary product-card__action--full"
                  href={product.productUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Item ↗
                </a>
              )
            )}
          </div>
        </div>

        {/* Select Mode - a transparent layer on top of everything else
            in the card, so a click toggles selection instead of
            reaching View Item/Edit/+ collection underneath it. */}
        {isSelectMode && (
          <button
            type="button"
            className={`product-card__select-layer ${isSelected ? "is-selected" : ""}`}
            onClick={() => onToggleSelect(product.id)}
            aria-pressed={isSelected}
            aria-label={isSelected ? `Deselect ${product.name}` : `Select ${product.name}`}
          >
            {isSelected && <span className="product-card__select-mark">✓</span>}
          </button>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
