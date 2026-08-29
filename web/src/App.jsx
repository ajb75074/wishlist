import { useEffect, useState } from "react";
import ProductCard from "./components/ProductCard";
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

  return (
    <div>
      <h1>Wishlist</h1>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p>No saved items yet.</p>
      )}
      {!loading && !error && products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onDelete={handleDelete}
          isDeleting={deletingId === product.id}
          onUpdate={handleUpdate}
          isUpdating={updatingId === product.id}
        />
      ))}
    </div>
  );
}

export default App;
