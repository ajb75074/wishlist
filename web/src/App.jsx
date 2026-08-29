import { useEffect, useState } from "react";
import ProductGrid from "./components/ProductGrid";
import FilterBar from "./components/FilterBar";
import Header from "./components/header/header";
import { categorizeProduct } from "./lib/categorize";
import { basicColor } from "./lib/basicColor";
import {
  deleteWishlistItem,
  getWishlistItems,
  updateWishlistItem,
} from "./lib/wishlist";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedColor, setSelectedColor] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  useEffect(() => {
    async function loadWishlist() {
      try {
        const wishlistItems = await getWishlistItems();
        setProducts(wishlistItems);
      } catch {
        setError("Could not load your wishlist.");
      } finally {
        setLoading(false);
      }
    }

    loadWishlist();
  }, []);

  async function handleDelete(id) {
    const shouldDelete = window.confirm(
      "Are you sure you want to remove this item?",
    );

    if (!shouldDelete) {
      return;
    }

    setError(null);
    setDeletingId(id);

    try {
      const result = await deleteWishlistItem(id);

      if (!result.success) {
        setError("Could not remove this item.");
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== id),
      );
    } catch {
      setError("Could not remove this item.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdate(id, updates) {
    setError(null);
    setUpdatingId(id);

    try {
      const result = await updateWishlistItem(id, updates);

      if (!result.success) {
        setError("Could not save your changes.");
        return { success: false };
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === id ? result.product : product,
        ),
      );

      return { success: true };
    } catch {
      setError("Could not save your changes.");
      return { success: false };
    } finally {
      setUpdatingId(null);
    }
  }

  const query = searchTerm.trim().toLowerCase();

  let filteredProducts = query
    ? products.filter((product) =>
        [product.name, product.store, product.color].some((field) =>
          field?.toLowerCase().includes(query),
        ),
      )
    : products;

  if (selectedCategory !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => categorizeProduct(product) === selectedCategory,
    );
  }

  if (selectedStore !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => product.store === selectedStore,
    );
  }

  if (selectedColor !== "All") {
    filteredProducts = filteredProducts.filter(
      (product) => basicColor(product.color) === selectedColor,
    );
  }

  if (sortOrder === "price-desc") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    );
  } else if (sortOrder === "price-asc") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
    );
  }

  return (
    <div className="app">
    <Header searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p>No saved items yet.</p>
      )}
      {!loading && !error && products.length > 0 && (
        <FilterBar
          products={products}
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          store={selectedStore}
          onStoreChange={setSelectedStore}
          color={selectedColor}
          onColorChange={setSelectedColor}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
      )}
      {!loading && !error && products.length > 0 && filteredProducts.length === 0 && (
        <p>No items match your filters.</p>
      )}
      {!loading && !error && filteredProducts.length > 0 && (
        <ProductGrid
          products={filteredProducts}
          onDelete={handleDelete}
          deletingId={deletingId}
          onUpdate={handleUpdate}
          updatingId={updatingId}
        />
      )}
    </div>
  );
}

export default App;
