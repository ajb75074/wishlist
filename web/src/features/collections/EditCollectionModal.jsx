import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./CreateCollectionModal.css";

// Same curated palette CreateCollectionModal uses - kept in sync
// manually rather than shared/exported, matching this app's existing
// convention of small per-file constants over premature sharing.
const COLOR_PALETTE = [
  { name: "soft pink", value: "#f3a6c0" },
  { name: "muted lavender", value: "#c9b8e8" },
  { name: "pale blue", value: "#a9c9e0" },
  { name: "cream", value: "#e8dcc8" },
  { name: "muted green", value: "#b8d4b0" },
  { name: "peach", value: "#f0b8a0" },
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
        <div className="create-collection-modal__header">
          <h2 id="edit-collection-title" className="modal__title">
            edit collection
          </h2>

          <button
            type="button"
            className="create-collection-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            className="create-collection-modal__label"
            htmlFor="edit-collection-name"
          >
            name
          </label>

          <input
            id="edit-collection-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jamaica Trip"
            disabled={isSubmitting}
          />

          <div className="create-collection-modal__thumbnail-section">
            <span className="create-collection-modal__label">cover</span>

            <div className="cover-toggle" role="group" aria-label="Cover type">
              <button
                type="button"
                className={thumbnailMode === "image" ? "active" : ""}
                onClick={() => setThumbnailMode("image")}
                disabled={isSubmitting}
              >
                image
              </button>

              <button
                type="button"
                className={thumbnailMode === "color" ? "active" : ""}
                onClick={() => setThumbnailMode("color")}
                disabled={isSubmitting}
              >
                color
              </button>
            </div>

            {thumbnailMode === "image" ? (
              <>
                <label
                  className="create-collection-modal__label"
                  htmlFor="edit-collection-image-url"
                >
                  image url
                </label>

                <input
                  id="edit-collection-image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={isSubmitting}
                />
              </>
            ) : (
              <div
                className="color-palette"
                role="group"
                aria-label="Choose a color"
              >
                {COLOR_PALETTE.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    className={`color-swatch ${color === swatch.value ? "active" : ""}`}
                    style={{ backgroundColor: swatch.value }}
                    onClick={() => setColor(swatch.value)}
                    aria-label={swatch.name}
                    aria-pressed={color === swatch.value}
                    disabled={isSubmitting}
                  />
                ))}
              </div>
            )}
          </div>

          {errorMessage && <p className="modal__error">{errorMessage}</p>}

          <div className="modal__actions">
            <button type="button" className="modal__button" onClick={onClose} disabled={isSubmitting}>
              cancel
            </button>

            <button type="submit" className="modal__button modal__button--primary" disabled={isSubmitting}>
              {isSubmitting ? "saving..." : "save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditCollectionModal;
