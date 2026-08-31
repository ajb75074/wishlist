import ProductCard from "./ProductCard";
import "./ProductGrid.css";

function ProductGrid({
  products,
  onUpdate,
  updatingId,
  context = "all",
  onAddToCollection,
  isSelectMode = false,
  selectedProductIds,
  onToggleSelect,
  autoEditProductId,
  autoEditKey,
}) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onUpdate={onUpdate}
          isUpdating={updatingId === product.id}
          context={context}
          onAddToCollection={onAddToCollection}
          isSelectMode={isSelectMode}
          isSelected={Boolean(selectedProductIds?.has(product.id))}
          onToggleSelect={onToggleSelect}
          startEditSignal={product.id === autoEditProductId ? autoEditKey : null}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
