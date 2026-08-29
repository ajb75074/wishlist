import { useRef, useState } from "react";
import "./ProductCard.css";

// Pixel-style trash icon for the low-emphasis "remove" action.
// fill uses currentColor so CSS controls its color/hover state.
function TrashIcon() {
  return (
    <svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
      <path d="m25.905 8.38 0 16.76 1.53 0 0 -16.76 3.04 0 0 -1.52 -1.52 0 0 -1.53 -6.1 0 0 -3.05 -1.52 0 0 3.05 -10.67 0 0 -3.05 -1.52 0 0 3.05 -6.09 0 0 1.53 -1.53 0 0 1.52 3.05 0 0 16.76 1.52 0 0 -16.76 19.81 0z" fill="currentColor" />
      <path d="M24.385 25.14h1.52v4.57h-1.52Z" fill="currentColor" />
      <path d="M7.625 29.71h16.76v1.53H7.625Z" fill="currentColor" />
      <path d="M21.335 11.43h1.52v12.19h-1.52Z" fill="currentColor" />
      <path d="M19.815 23.62h1.52v3.04h-1.52Z" fill="currentColor" />
      <path d="M15.245 11.43h1.52v15.23h-1.52Z" fill="currentColor" />
      <path d="M10.665 0.76h10.67v1.52h-10.67Z" fill="currentColor" />
      <path d="M10.665 23.62h1.53v3.04h-1.53Z" fill="currentColor" />
      <path d="M9.145 11.43h1.52v12.19h-1.52Z" fill="currentColor" />
      <path d="M6.095 25.14h1.53v4.57h-1.53Z" fill="currentColor" />
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
  onDelete,
  isDeleting,
  onUpdate,
  isUpdating,
}) {
  // Controls whether the overlay is showing inputs instead of text
  const [isEditing, setIsEditing] = useState(false);

  // Stores temporary edit values
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");

  // Focus the color input the moment editing opens
  const colorInputRef = useRef(null);

  // Open inline editing with current values
  function startEditing() {
    setColorInput(product.color || "");
    setSizeInput(product.size || "");
    setIsEditing(true);
    requestAnimationFrame(() => colorInputRef.current?.focus());
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
      <div className="product-card__visual">
        {/* Product image */}
        <img
          className="product-card__image"
          src={product.imageUrl}
          alt={product.name}
        />

        {/* Decorative for now, no favorite behavior yet */}
        <span className="product-card__favorite">
          <HeartIcon />
        </span>

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
              <>
                <button
                  type="button"
                  className="product-card__action product-card__action--secondary"
                  onClick={startEditing}
                >
                  Edit
                </button>

                <a
                  className="product-card__action product-card__action--primary"
                  href={product.productUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Item ↗
                </a>
              </>
            )}
          </div>

          {/* Delete only surfaces while editing, kept low-emphasis */}
          {isEditing && (
            <button
              type="button"
              className="product-card__remove"
              onClick={() => onDelete(product.id)}
              disabled={isDeleting || isUpdating}
              aria-label={isDeleting ? "Removing item" : "Remove item"}
              title={isDeleting ? "Removing item" : "Remove item"}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
