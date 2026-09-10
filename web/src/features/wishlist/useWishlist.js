import { useEffect, useState } from "react";
import { deleteWishlistItem, getWishlistItems, updateWishlistItem } from "./wishlist";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";

export function useWishlist() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Quiet background refetch on tab focus - no loading state, failures
  // swallowed.
  useRefetchOnFocus(async () => {
    try {
      const wishlistItems = await getWishlistItems();
      setProducts(wishlistItems);
    } catch {
      // fail quietly
    }
  });

  async function performDelete(id) {
    setError(null);

    try {
      const result = await deleteWishlistItem(id);

      if (!result.success) {
        setError("Could not remove this item.");
        return { success: false };
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== id),
      );

      return { success: true };
    } catch {
      setError("Could not remove this item.");
      return { success: false };
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

      return { success: true, product: result.product };
    } catch {
      setError("Could not save your changes.");
      return { success: false };
    } finally {
      setUpdatingId(null);
    }
  }

  // Called after AddItemModal's own upload/insert already succeeded -
  // only updates local state. Prepended to match getWishlistItems()'s
  // newest-first ordering, without a full refetch.
  function handleCreate(product) {
    setProducts((currentProducts) => [product, ...currentProducts]);
  }

  return { products, loading, error, updatingId, performDelete, handleUpdate, handleCreate };
}
