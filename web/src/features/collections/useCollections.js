import { useEffect, useState } from "react";
import { createCollection, deleteCollection, getCollections } from "./collections";

// Owns the collections list and its CRUD. Deliberately doesn't know
// about `selectedCollection`/navigation - that's App-level concern.
// `onCollectionDeleted` lets App.jsx react (e.g. back out of a detail
// view) without this hook needing to understand navigation at all.
export function useCollections({ onCollectionDeleted } = {}) {
  const [collections, setCollections] = useState([]);
  // Collection pending deletion confirmation, or null.
  const [collectionPendingDelete, setCollectionPendingDelete] = useState(null);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);
  const [deleteCollectionError, setDeleteCollectionError] = useState("");

  useEffect(() => {
    async function loadCollections() {
      try {
        const existingCollections = await getCollections();
        setCollections(existingCollections);
      } catch (err) {
        console.error("Could not load collections.", err);
      }
    }

    loadCollections();
  }, []);

  async function handleCreateCollection({ name, imageUrl, color }) {
    try {
      const collection = await createCollection({ name, imageUrl, color });
      setCollections((current) => [collection, ...current]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function handleRequestDeleteCollection(collection) {
    setDeleteCollectionError("");
    setCollectionPendingDelete(collection);
  }

  function handleCancelDeleteCollection() {
    if (isDeletingCollection) return;
    setCollectionPendingDelete(null);
    setDeleteCollectionError("");
  }

  // Deletes the collection itself - the database's ON DELETE CASCADE
  // handles its collection_items rows, so the wishlist items that were
  // in it are untouched and stay in All Saves / any other collection.
  async function handleConfirmDeleteCollection() {
    setIsDeletingCollection(true);
    setDeleteCollectionError("");

    try {
      await deleteCollection(collectionPendingDelete.id);

      setCollections((current) =>
        current.filter((collection) => collection.id !== collectionPendingDelete.id),
      );

      onCollectionDeleted?.(collectionPendingDelete.id);
      setCollectionPendingDelete(null);
    } catch {
      setDeleteCollectionError("Could not delete this collection. Please try again.");
    } finally {
      setIsDeletingCollection(false);
    }
  }

  return {
    collections,
    handleCreateCollection,
    collectionPendingDelete,
    isDeletingCollection,
    deleteCollectionError,
    handleRequestDeleteCollection,
    handleCancelDeleteCollection,
    handleConfirmDeleteCollection,
  };
}
