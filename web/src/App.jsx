import { useEffect, useState } from "react";
import ProductCard from "./components/ProductCard";
import { getWishlistItems } from "./lib/wishlist";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div>
      <h1>Wishlist</h1>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p>No saved items yet.</p>
      )}
      {!loading && !error && products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default App;
