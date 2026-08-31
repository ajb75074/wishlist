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

// "+ add pieces" and "edit look ♡" are shells only - no onClick, same
// "leave the handler off" approach used before Create Look had a modal
// to open. Wiring them up is planned work for a later stage, not this one.
function LookDetailView({ look, collectionName, onBack }) {
  const pieceCount = look.wishitems.length;

  return (
    <div className="look-detail">
      <button type="button" className="look-detail__back" onClick={onBack}>
        ← {collectionName}
      </button>

      <h2 className="look-detail__title">{look.name} ♡</h2>

      <LookBed pieces={look.wishitems} />

      <div className="look-detail__actions-row">
        <p className="look-detail__count">
          {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
        </p>

        <button type="button" className="look-detail__button">
          + add pieces
        </button>
      </div>

      {pieceCount > 0 && (
        <div className="look-detail__pieces-section">
          <p className="look-detail__pieces-label">pieces in this look</p>

          <div className="look-detail__pieces-list">
            {look.wishitems.map((piece) => (
              <div key={piece.id} className="look-detail__piece-thumb">
                <img src={piece.imageUrl} alt={piece.name} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="look-detail__button look-detail__edit">
        edit look ♡
      </button>
    </div>
  );
}

export default LookDetailView;
