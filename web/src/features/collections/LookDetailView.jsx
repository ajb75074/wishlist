import { useState } from "react";
import AddPiecesModal from "./AddPiecesModal";
import "./LookDetailView.css";

// Detail preview caps at more pieces than LookCard's compact collage
// (4) since there's far more room here - this is the planning surface,
// not the browsing thumbnail.
const MAX_BED_PIECES = 5;

// Simple, neutral, geometric - not a real face. No avatar asset exists
// yet in the project, so this is the "existing UI primitives" fallback
// the spec asked for, in the same inline-SVG style as ProductCard's
// decorative HeartIcon.
function AvatarFace() {
  return (
    <svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="18" r="2.4" fill="currentColor" />
      <circle cx="28" cy="18" r="2.4" fill="currentColor" />
      <path
        d="M13 26c3 3 11 3 14 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// Deterministic, count-based placement over a stylized bed backdrop -
// same "no math, just count-keyed CSS" idea as LookCard's collage, but
// with absolute positioning + subtle rotation instead of a grid, since
// this is meant to read as a loosely arranged outfit board rather than
// a clean browsing tile. Pieces are real retailer photos (no cutouts),
// so object-fit: contain + a small mounted-photo backing card keeps
// each one fully visible instead of cropping it.
function LookBed({ pieces }) {
  const visiblePieces = pieces.slice(0, MAX_BED_PIECES);
  const remaining = pieces.length - visiblePieces.length;

  return (
    <div className="look-bed">
      <div className="look-bed__avatar" aria-hidden="true">
        <AvatarFace />
      </div>

      <div className="look-bed__surface">
        <div className="look-bed__headboard" aria-hidden="true" />
        <div className="look-bed__pillow look-bed__pillow--left" aria-hidden="true" />
        <div className="look-bed__pillow look-bed__pillow--right" aria-hidden="true" />

        {visiblePieces.length > 0 ? (
          <div className={`look-bed__pieces look-bed__pieces--${visiblePieces.length}`}>
            {visiblePieces.map((piece, index) => (
              <div key={piece.id} className="look-bed__piece">
                <img src={piece.imageUrl} alt={piece.name} />

                {remaining > 0 && index === visiblePieces.length - 1 && (
                  <span className="look-bed__more" aria-hidden="true">
                    +{remaining}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="look-bed__empty">no pieces in this look yet</p>
        )}
      </div>
    </div>
  );
}

// "edit look ♡" stays a shell only - no onClick yet, same "leave the
// handler off" approach used before Create Look had a modal to open.
// Add/remove pieces are real now; arrangement editing is still later work.
function LookDetailView({
  look,
  collectionName,
  onBack,
  collectionPieces,
  onAddPieces,
  onRemovePiece,
}) {
  const [isAddPiecesModalOpen, setIsAddPiecesModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");
  const pieceCount = look.wishitems.length;

  async function handleRemoveClick(piece) {
    setRemoveError("");
    setRemovingId(piece.id);

    const result = await onRemovePiece(piece.id);

    if (!result.success) {
      setRemoveError(result.error);
    }

    setRemovingId(null);
  }

  return (
    <div className="look-detail">
      <button type="button" className="look-detail__back" onClick={onBack}>
        ← {collectionName}
      </button>

      <h2 className="look-detail__title">{look.name} ♡</h2>

      <div className="look-detail__layout">
        <div className="look-detail__canvas">
          <LookBed pieces={look.wishitems} />
        </div>

        {/* Secondary to the bed - compact thumbnails, not ProductCards. */}
        <div className="look-detail__panel">
          <div className="look-detail__panel-header">
            <p className="look-detail__pieces-label">pieces in this look</p>
            <p className="look-detail__count">
              {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
            </p>
          </div>

          {removeError && <p className="look-detail__panel-error">{removeError}</p>}

          {pieceCount > 0 ? (
            <div className="look-detail__pieces-list">
              {look.wishitems.map((piece) => (
                <div key={piece.id} className="look-detail__piece-thumb">
                  <img src={piece.imageUrl} alt={piece.name} />

                  <button
                    type="button"
                    className="look-detail__piece-remove"
                    onClick={() => handleRemoveClick(piece)}
                    disabled={removingId === piece.id}
                    aria-label={`Remove ${piece.name} from look`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="look-detail__panel-empty">no pieces in this look yet ♡</p>
          )}

          <button
            type="button"
            className="look-detail__button look-detail__add-pieces"
            onClick={() => setIsAddPiecesModalOpen(true)}
          >
            + add pieces ♡
          </button>
        </div>
      </div>

      <button type="button" className="look-detail__button look-detail__edit">
        edit look ♡
      </button>

      {isAddPiecesModalOpen && (
        <AddPiecesModal
          collectionName={collectionName}
          collectionPieces={collectionPieces}
          existingWishitemIds={new Set(look.wishitems.map((piece) => piece.id))}
          onClose={() => setIsAddPiecesModalOpen(false)}
          onAdd={onAddPieces}
        />
      )}
    </div>
  );
}

export default LookDetailView;
