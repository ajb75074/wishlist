import "./LookCard.css";

const MAX_PREVIEW_IMAGES = 4;

// Deterministic, count-based composition - not a draggable canvas. Each
// look-collage--N class (defined in LookCard.css) arranges however many
// cells are visible via CSS Grid spans; there's nothing to compute here.
function LookCollage({ pieces }) {
  if (pieces.length === 0) {
    return <div className="look-collage look-collage--0" />;
  }

  const visiblePieces = pieces.slice(0, MAX_PREVIEW_IMAGES);
  const remaining = pieces.length - visiblePieces.length;

  return (
    <div className={`look-collage look-collage--${visiblePieces.length}`}>
      {visiblePieces.map((piece, index) => (
        <div key={piece.id} className="look-collage__item">
          <img
            className="look-collage__image"
            src={piece.imageUrl}
            alt={piece.name}
          />

          {remaining > 0 && index === visiblePieces.length - 1 && (
            <span className="look-collage__more" aria-hidden="true">
              +{remaining}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// No onClick yet - Look Detail doesn't exist. A plain button still gives
// real keyboard focus and hover affordance without a dead link or a
// fake destination, same "leave the handler off" approach the Looks
// empty state's create button used before its modal existed.
function LookCard({ look }) {
  const pieceCount = look.wishitems.length;

  return (
    <button type="button" className="look-card">
      <LookCollage pieces={look.wishitems} />

      <div className="look-card__meta">
        <p className="look-card__name">{look.name}</p>
        <p className="look-card__count">
          {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
        </p>
      </div>
    </button>
  );
}

export default LookCard;
