import { useEffect, useRef, useState } from "react";
import CollectionThumbnail from "./CollectionThumbnail";
import "../../components/modal.css";
import "./CreateCollectionModal.css";

// Same curated palette CreateCollectionModal uses - kept in sync
// manually rather than shared/exported, matching this app's existing
// convention of small per-file constants over premature sharing.
const COLOR_PALETTE = [
  { name: "blush", value: "#fadadd" },
  { name: "strawberry", value: "#e95d75" },
  { name: "pistachio", value: "#dde8d4" },
  { name: "butter", value: "#f5e6b8" },
  { name: "powder blue", value: "#c3d9e8" },
  { name: "peach", value: "#f5c9a8" },
];

// App only renders this while a collection is being edited, so each
// open is a fresh mount, pre-filled from the collection passed in -
// same fresh-mount-per-open pattern every other modal in this app uses.
function EditCollectionModal({ collection, onClose, onSave }) {
  const [name, setName] = useState(collection.name);
  const [thumbnailMode, setThumbnailMode] = useState(collection.imageUrl ? "image" : "color");
  const [imageUrl, setImageUrl] = useState(collection.imageUrl || "");
  const [color, setColor] = useState(collection.color || COLOR_PALETTE[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!name.trim()) {
      setErrorMessage("Please enter a collection name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result = await onSave({
      name,
      imageUrl: thumbnailMode === "image" ? imageUrl : "",
      color,
    });

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Could not save these changes.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-collection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-collection-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="edit-collection-title" className="modal__title">
            Edit collection
          </h2>

          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-field-group">
            <label className="modal-field-label" htmlFor="edit-collection-name">
              Name *
            </label>

            <input
              id="edit-collection-name"
              ref={inputRef}
              className="modal-field"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jamaica Trip"
              disabled={isSubmitting}
            />
          </div>

          <div className="create-collection-modal__cover">
            <div className="create-collection-modal__cover-main">
              <span className="modal-field-label">Cover</span>

              <div className="cover-toggle" role="group" aria-label="Cover type">
                <button
                  type="button"
                  className={thumbnailMode === "image" ? "active" : ""}
                  onClick={() => setThumbnailMode("image")}
                  disabled={isSubmitting}
                >
                  Image
                </button>

                <button
                  type="button"
                  className={thumbnailMode === "color" ? "active" : ""}
                  onClick={() => setThumbnailMode("color")}
                  disabled={isSubmitting}
                >
                  Color
                </button>
              </div>

              {thumbnailMode === "image" ? (
                <div className="modal-field-group">
                  <label className="modal-field-label" htmlFor="edit-collection-image-url">
                    Image URL
                  </label>

                  <input
                    id="edit-collection-image-url"
                    className="modal-field"
                    type="url"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={isSubmitting}
                  />
                </div>
              ) : (
                <div className="color-palette" role="group" aria-label="Choose a color">
                  {COLOR_PALETTE.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`color-swatch ${color === swatch.value ? "active" : ""}`}
                      style={{ backgroundColor: swatch.value }}
                      onClick={() => setColor(swatch.value)}
                      aria-label={swatch.name}
                      title={swatch.name}
                      aria-pressed={color === swatch.value}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="create-collection-modal__preview">
              <CollectionThumbnail
                imageUrl={thumbnailMode === "image" ? imageUrl : ""}
                color={color}
                size={72}
              />
              <span className="create-collection-modal__preview-name">
                {name.trim() || "your collection"}
              </span>
            </div>
          </div>

          {errorMessage && <p className="modal__error">{errorMessage}</p>}

          <div className="modal__actions">
            <button
              type="button"
              className="modal__button modal__button--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="submit" className="modal__button modal__button--primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditCollectionModal;
