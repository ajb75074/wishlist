import { useEffect, useRef, useState } from "react";
import { parsePriceInput } from "../../lib/priceInput";
import "./ProductCard.css";

function AddToCollectionIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect x="7" y="1" width="2" height="14" fill="currentColor" />
      <rect x="1" y="7" width="14" height="2" fill="currentColor" />
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
  const [isEditing, setIsEditing] = useState(false);

  const [colorInput, setColorInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState(false);

  // Focus the color input whenever editing begins, from either trigger
  // below - a real DOM side effect, so this belongs in an effect.
  const colorInputRef = useRef(null);
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => colorInputRef.current?.focus());
    }
  }, [isEditing]);

  // startEditSignal changes value on every click, so the same card can be re-
  // opened twice in a row.
  const [lastEditSignal, setLastEditSignal] = useState(startEditSignal);
  if (startEditSignal && startEditSignal !== lastEditSignal) {
    setLastEditSignal(startEditSignal);
    setColorInput(product.color || "");
    setPriceInput(product.price != null ? String(product.price) : "");
    setPriceError(false);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function saveEditing() {
    const priceResult = parsePriceInput(priceInput);
    if (!priceResult.valid) {
      setPriceError(true);
      return;
    }
    setPriceError(false);

    const result = await onUpdate(product.id, {
      color: colorInput.trim() || null,
      price: priceResult.value,
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

            {!isEditing && (
              <p className="product-card__price">
                {product.price
                  ? `$${product.price}`
                  : "Price unavailable"}
              </p>
            )}

            {/* Product metadata, editable in place */}
            <div className="product-card__meta">
              {isEditing && (
                <div>
                  <span>PRICE</span>
                  <input
                    className="product-card__meta-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 128.00"
                    value={priceInput}
                    onChange={(event) => {
                      setPriceInput(event.target.value);
                      setPriceError(false);
                    }}
                    disabled={isUpdating}
                  />
                  {priceError && (
                    <p className="product-card__meta-error">Enter a valid price.</p>
                  )}
                </div>
              )}

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
              // A manual item may have no link at all, so View Item is
              // conditional.
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
