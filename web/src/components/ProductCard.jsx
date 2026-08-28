function ProductCard({ product }) {
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
    </div>
  );
}

export default ProductCard;