import { Navigate, useParams } from "react-router-dom";
import CollectionDetailView from "./CollectionDetailView";

// Resolves the human-readable :collectionName URL segment (e.g. "irish")
// against the already-loaded collections list, rather than adding a
// second by-name Supabase lookup - the full list is already in memory
// via useCollections. Matched case-insensitively so the URL is
// forgiving of casing. Falls back to the Collections grid if the name
// doesn't match anything (stale bookmark, renamed/deleted collection)
// once collections have actually finished loading - a fresh page
// load/refresh straight into this route otherwise briefly finds
// nothing before the mount fetch resolves.
function CollectionRoute({ collections, isLoadingCollections, onUpdate, updatingId }) {
  const { collectionName } = useParams();

  const collection = collections.find(
    (item) => item.name.toLowerCase() === collectionName.toLowerCase(),
  );

  if (!collection) {
    if (isLoadingCollections) {
      return <p className="collection-detail__status">Loading...</p>;
    }
    return <Navigate to="/collections" replace />;
  }

  return (
    <CollectionDetailView
      collection={collection}
      onUpdate={onUpdate}
      updatingId={updatingId}
    />
  );
}

export default CollectionRoute;
