import ProductCard from "./ProductCard";
import "./ProductGrid.css";

function ProductGrid({
  products,
  onDelete,
  deletingId,
  onUpdate,
  updatingId,
}) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onDelete={onDelete}
          isDeleting={deletingId === product.id}
          onUpdate={onUpdate}
          isUpdating={updatingId === product.id}
        />
      ))}
    </div>
  );
}

export default ProductGrid;