import { useState } from "react";

function ProductCard({ product, onDelete, isDeleting, onUpdate, isUpdating }) {
  const [isEditing, setIsEditing] = useState(false);
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");

  function startEditing() {
    setColorInput(product.color || "");
    setSizeInput(product.size || "");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function saveEditing() {
    // Empty input means "clear this field" -> store as null, not "".
    const result = await onUpdate(product.id, {
      color: colorInput.trim() || null,
      size: sizeInput.trim() || null,
    });

    if (result.success) {
      setIsEditing(false);
    }
  }

  return (
    <div>
      <img
        src={product.imageUrl}
        alt={product.name}
        width="200"
      />

      <h2>{product.name}</h2>

      <p>{product.store}</p>

      <p>
        {product.price
          ? `$${product.price}`
          : "Price unavailable"}
      </p>

      {isEditing ? (
        <div>
          <p>
            Color:{" "}
            <input
              type="text"
              value={colorInput}
              onChange={(event) => setColorInput(event.target.value)}
              disabled={isUpdating}
            />
          </p>

          <p>
            Size:{" "}
            <input
              type="text"
              value={sizeInput}
              onChange={(event) => setSizeInput(event.target.value)}
              disabled={isUpdating}
            />
          </p>

          <button type="button" onClick={saveEditing} disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={cancelEditing} disabled={isUpdating}>
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <p>Color: {product.color || "Not specified"}</p>
          <p>Size: {product.size || "Not specified"}</p>

          <button type="button" onClick={startEditing}>
            Edit
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDelete(product.id)}
        disabled={isDeleting}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}

export default ProductCard;
