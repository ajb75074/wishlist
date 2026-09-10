import { useState } from "react";
import "./CollectionThumbnail.css";

function CollectionThumbnail({ imageUrl, color, size, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset the failed-flag when the url itself changes (e.g. the user
  // edits the field), without needing a setState-in-effect.
  const [lastImageUrl, setLastImageUrl] = useState(imageUrl);
  if (imageUrl !== lastImageUrl) {
    setLastImageUrl(imageUrl);
    setImageFailed(false);
  }

  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <span
      className={`collection-thumbnail ${className}`}
      style={{
        // Fixed-size callers pass a pixel size; callers that size this via
        // CSS pass none.
        ...(size ? { width: size, height: size } : null),
        backgroundColor: showImage ? undefined : color,
      }}
    >
      {showImage && (
        <img src={imageUrl} alt="" onError={() => setImageFailed(true)} />
      )}
    </span>
  );
}

export default CollectionThumbnail;
