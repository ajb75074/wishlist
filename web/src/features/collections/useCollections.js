import { useEffect, useState } from "react";
import { createCollection, deleteCollection, getCollections, updateCollection } from "./collections";

// Owns the collections list and its CRUD. Deliberately doesn't know
// about `selectedCollection`/navigation - that's App-level concern.
// `onCollectionDeleted` lets App.jsx react (e.g. back out of a detail
// view) without this hook needing to understand navigation at all.
export function useCollections({ onCollectionDeleted } = {}) {
  const [collections, setCollections] = useState([]);
  // Lets routing tell "not found" (bad/stale URL) apart from "haven't
  // fetched yet" (fresh page load/refresh straight into a collection or
  // Look Studio URL, before this mount effect resolves).
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  // Collection pending deletion confirmation, or null.
  const [collectionPendingDelete, setCollectionPendingDelete] = useState(null);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);
  const [deleteCollectionError, setDeleteCollectionError] = useState("");
  // The collection currently open in the edit modal, or null - doubles
  // as both "is the modal open" and "which collection to pre-fill it
  // with", same pattern LookDetailView's preparingPiece uses.
  const [editingCollection, setEditingCollection] = useState(null);

  useEffect(() => {
    async function loadCollections() {
      try {
        const existingCollections = await getCollections();
        setCollections(existingCollections);
      } catch (err) {
        console.error("Could not load collections.", err);
      } finally {
        setIsLoadingCollections(false);
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

  function handleRequestEditCollection(collection) {
    setEditingCollection(collection);
  }

  function handleCancelEditCollection() {
    setEditingCollection(null);
  }

  // Same {name, imageUrl, color} shape handleCreateCollection takes, so
  // EditCollectionModal can reuse CreateCollectionModal's own field
  // handling almost verbatim.
  async function handleUpdateCollection({ name, imageUrl, color }) {
    try {
      const updated = await updateCollection(editingCollection.id, { name, imageUrl, color });
      setCollections((current) =>
        current.map((collection) => (collection.id === updated.id ? updated : collection)),
      );
      setEditingCollection(null);
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
    isLoadingCollections,
    handleCreateCollection,
    editingCollection,
    handleRequestEditCollection,
    handleCancelEditCollection,
    handleUpdateCollection,
    collectionPendingDelete,
    isDeletingCollection,
    deleteCollectionError,
    handleRequestDeleteCollection,
    handleCancelDeleteCollection,
    handleConfirmDeleteCollection,
  };
}
