import { Navigate, useParams } from "react-router-dom";
import CollectionDetailView from "./CollectionDetailView";

// Resolves :collectionName case-insensitively against the already-loaded
// list, falling back only once loading has finished.
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
