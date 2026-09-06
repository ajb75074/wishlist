import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import "../../components/modal.css";
import "./AddItemModal.css";
import {
  ALLOWED_ITEM_IMAGE_TYPES,
  MAX_ITEM_IMAGE_BYTES,
  removeItemImage,
  saveWishlistItem,
  uploadItemImage,
} from "./wishlist";

// Non-negative decimal, optionally with a leading $ and thousands
// separators the user might naturally type - anything else is
// rejected outright rather than silently coerced (the extension's own
// normalizePrice strips non-numeric characters first, which would
// turn "abc" into 0 via Number("") - deliberately not reused here).
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

function parsePriceInput(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { valid: true, value: null };
  }

  const cleaned = trimmed.replace(/^\$/, "").replace(/,/g, "");

  if (!PRICE_PATTERN.test(cleaned)) {
    return { valid: false };
  }

  return { valid: true, value: Number(cleaned) };
}

function parseProductUrlInput(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { valid: true, value: null };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false };
    }
    return { valid: true, value: url.toString() };
  } catch {
    return { valid: false };
  }
}

// App only renders this while the modal should be open, so each open
// is a fresh mount - form state, the preview, and the one UUID this
// creation lifecycle uses all start clean for free, same pattern as
// every other modal in this app.
function AddItemModal({ onClose, onCreated }) {
  const { user } = useAuth();

  // Generated once per mount (lazy - only on first render), reused
  // across every retry within this same open/submit lifecycle so a
  // failed attempt never abandons one Storage upload just to make
  // another under a different, orphaned path. A genuinely fresh
  // lifecycle only ever starts from a fresh mount (closing and
  // reopening the modal), which naturally produces a new one.
  const wishitemIdRef = useRef(null);
  if (wishitemIdRef.current === null) {
    wishitemIdRef.current = crypto.randomUUID();
  }

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const previewUrlRef = useRef(null);
  const fileInputRef = useRef(null);

  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [price, setPrice] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [color, setColor] = useState("");
  const [isOwned, setIsOwned] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Synchronous lock, not just isSubmitting - the same reasoning as
  // ChangePasswordModal's isSubmittingRef: isSubmitting is regular
  // React state, so a second submit landing before the next render
  // commits could still read the old (false) value. This is set in
  // the same tick as the check, so a duplicate call (rapid
  // double-click, double Enter) can never slip through and produce a
  // second UUID, upload, or wishitem.
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function handleClose() {
    if (isSubmitting) return;
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting]);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    // Clears the input so re-selecting the same file still fires a
    // change event.
    event.target.value = "";
    if (!file) return;

    setErrorMessage("");

    if (!ALLOWED_ITEM_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage("Please choose a PNG, JPEG, or WebP image.");
      return;
    }

    if (file.size > MAX_ITEM_IMAGE_BYTES) {
      setErrorMessage("That image is too large - please choose one under 5MB.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPhotoFile(file);
    setPhotoPreviewUrl(url);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRef.current) return;

    if (!photoFile) {
      setErrorMessage("Please add a photo.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter an item name.");
      return;
    }

    const priceResult = parsePriceInput(price);
    if (!priceResult.valid) {
      setErrorMessage("Please enter a valid price.");
      return;
    }

    const productUrlResult = parseProductUrlInput(productUrl);
    if (!productUrlResult.valid) {
      setErrorMessage("Please enter a valid product link (starting with http:// or https://).");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    const wishitemId = wishitemIdRef.current;

    try {
      const uploadResult = await uploadItemImage(user.id, wishitemId, photoFile);

      if (!uploadResult.success) {
        setErrorMessage("Could not upload your photo. Please try again.");
        return;
      }

      const saveResult = await saveWishlistItem({
        id: wishitemId,
        name: trimmedName,
        price: priceResult.value,
        productUrl: productUrlResult.value,
        store: store.trim() || null,
        color: color.trim() || null,
        isOwned,
        itemImagePath: uploadResult.path,
        imageUrl: null,
      });

      if (!saveResult.success) {
        // The row was never created (or wasn't the one this photo was
        // meant for) - the upload is now orphaned, clean it up rather
        // than leaving it behind. Best-effort: if this also fails, the
        // user still sees the real error below, not a second one.
        await removeItemImage(uploadResult.path);

        if (saveResult.duplicate) {
          setErrorMessage("This item is already in your saves.");
        } else {
          setErrorMessage("Could not save this item. Please try again.");
        }
        return;
      }

      onCreated(saveResult.product);
      onClose();
    } catch {
      setErrorMessage("Could not save this item. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal add-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-item-title" className="modal__title">
          add item
        </h2>

        <form className="add-item-modal__form" onSubmit={handleSubmit}>
          <div className="add-item-modal__photo-row">
            <div className="add-item-modal__photo-preview">
              {photoPreviewUrl ? (
                <img src={photoPreviewUrl} alt="Selected item preview" />
              ) : (
                <span className="add-item-modal__photo-placeholder" aria-hidden="true">
                  no photo
                </span>
              )}
            </div>

            <div className="add-item-modal__photo-actions">
              <label className="add-item-modal__label" htmlFor="add-item-photo">
                photo *
              </label>

              <input
                ref={fileInputRef}
                id="add-item-photo"
                type="file"
                accept={ALLOWED_ITEM_IMAGE_TYPES.join(",")}
                onChange={handlePhotoChange}
                disabled={isSubmitting}
                hidden
              />

              <button
                type="button"
                className="add-item-modal__photo-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                {photoFile ? "change photo" : "choose photo"}
              </button>
            </div>
          </div>

          <label className="add-item-modal__label" htmlFor="add-item-name">
            item name *
          </label>
          <input
            id="add-item-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label className="add-item-modal__label" htmlFor="add-item-store">
            brand / store
          </label>
          <input
            id="add-item-store"
            type="text"
            value={store}
            onChange={(event) => setStore(event.target.value)}
            disabled={isSubmitting}
          />

          <label className="add-item-modal__label" htmlFor="add-item-price">
            price
          </label>
          <input
            id="add-item-price"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 128.00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={isSubmitting}
          />

          <label className="add-item-modal__label" htmlFor="add-item-product-url">
            product link
          </label>
          <input
            id="add-item-product-url"
            type="text"
            placeholder="https://..."
            value={productUrl}
            onChange={(event) => setProductUrl(event.target.value)}
            disabled={isSubmitting}
          />

          <label className="add-item-modal__label" htmlFor="add-item-color">
            color
          </label>
          <input
            id="add-item-color"
            type="text"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            disabled={isSubmitting}
          />

          <span className="add-item-modal__label">ownership</span>
          <div className="add-item-modal__ownership-toggle" role="group" aria-label="Ownership">
            <button
              type="button"
              className={`add-item-modal__ownership-btn${!isOwned ? " is-active" : ""}`}
              aria-pressed={!isOwned}
              onClick={() => setIsOwned(false)}
              disabled={isSubmitting}
            >
              saved
            </button>
            <button
              type="button"
              className={`add-item-modal__ownership-btn${isOwned ? " is-active" : ""}`}
              aria-pressed={isOwned}
              onClick={() => setIsOwned(true)}
              disabled={isSubmitting}
            >
              owned
            </button>
          </div>

          {errorMessage && <p className="modal__error">{errorMessage}</p>}

          <div className="modal__actions">
            <button type="button" className="modal__button" onClick={handleClose} disabled={isSubmitting}>
              cancel
            </button>
            <button type="submit" className="modal__button modal__button--primary" disabled={isSubmitting}>
              {isSubmitting ? "adding..." : "add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddItemModal;
