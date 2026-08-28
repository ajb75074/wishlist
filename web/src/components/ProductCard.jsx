function ProductCard({ product, onDelete, isDeleting }) {
  return (
    <div>
      <img
        src={product.imageUrl}
        alt={product.name}
        width="200"
      />

      <h2>{product.name}</h2>

      <p>{product.store}</p>

      <p>{product.color || ""}</p>

      <p>
        {product.price
          ? `$${product.price}`
          : "Price unavailable"}
      </p>

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
