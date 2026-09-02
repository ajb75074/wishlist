import { useEffect, useState } from "react";
import { deleteWishlistItem, getWishlistItems, updateWishlistItem } from "./wishlist";
import { useRefetchOnFocus } from "../../lib/useRefetchOnFocus";

// Owns the wishlist product list and the two mutations that touch it
// directly (delete, edit). Anything that just needs to read/filter the
// list (search, categories, Select Mode) stays at the App level, since
// it isn't really "wishlist data" - it's page-level presentation state.
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

  // Quiet background refetch when this tab regains focus - covers the
  // Chrome extension case directly: save a product there, switch back
  // to this tab, and it's already in the grid, no manual reload
  // needed. No loading state toggled and failures are swallowed - this
  // should feel like the data was just already there, not like a
  // visible reload, and a background check silently not working is
  // better than surfacing an error for something the user didn't
  // explicitly ask for.
  useRefetchOnFocus(async () => {
    try {
      const wishlistItems = await getWishlistItems();
      setProducts(wishlistItems);
    } catch {
      // fail quietly
    }
  });

  // The actual delete call - both a direct single-item delete and the
  // Donate flow (which confirms via its own modal, not window.confirm)
  // call this.
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

  return { products, loading, error, updatingId, performDelete, handleUpdate };
}
