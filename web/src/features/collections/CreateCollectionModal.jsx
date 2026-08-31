import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./CreateCollectionModal.css";

// A small curated palette in the app's existing pastel/pink register -
// "soft pink" reuses the sidebar's own active-nav color exactly.
const COLOR_PALETTE = [
  { name: "soft pink", value: "#f3a6c0" },
  { name: "muted lavender", value: "#c9b8e8" },
  { name: "pale blue", value: "#a9c9e0" },
  { name: "cream", value: "#e8dcc8" },
  { name: "muted green", value: "#b8d4b0" },
  { name: "peach", value: "#f0b8a0" },
];

// App only renders this component while the modal should be open, so
// each open is a fresh mount - form state starts clean for free, with
// no reset-on-open effect needed.
// Presentation + form state only - the actual Supabase call happens in
// App.jsx's onCreate handler, this component just calls it.
function CreateCollectionModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState("color");
  const [imageUrl, setImageUrl] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  // Autofocus the input on mount (i.e. as soon as the modal opens).
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Escape closes the modal.
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

    const result = await onCreate({
      name,
      imageUrl: thumbnailMode === "image" ? imageUrl : "",
      color,
    });

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Could not create the collection.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-collection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="create-collection-modal__header">
          <h2 id="create-collection-title" className="modal__title">
            create a new collection
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
            htmlFor="collection-name"
          >
            give it a name
          </label>

          <input
            id="collection-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jamaica Trip"
            disabled={isSubmitting}
          />

          <div className="create-collection-modal__thumbnail-section">
            <span className="create-collection-modal__label">choose a cover</span>

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
                  htmlFor="collection-image-url"
                >
                  image url
                </label>

                <input
                  id="collection-image-url"
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
              {isSubmitting ? "creating..." : "create collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateCollectionModal;
