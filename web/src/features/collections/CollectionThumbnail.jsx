import { useState } from "react";
import "./CollectionThumbnail.css";

// image loads -> show image. Otherwise (no url, or it failed) -> show color.
// Used by the Sidebar collection rows, the create-modal preview, and
// CollectionsView's large framed cards - one place that decides image-vs-color.
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
        // Fixed-size callers (Sidebar, modal previews) pass a pixel
        // size, unchanged. Callers that size this entirely via their
        // own CSS class (e.g. CollectionsView's large framed visual,
        // which needs width/height: 100% of a responsive container)
        // can omit size instead of fighting an inline px value.
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
