import { useEffect, useRef, useState } from "react";
import "./LookCard.css";

const MAX_PREVIEW_IMAGES = 4;

// Same Material Symbols "more_vert" icon as SelectModeBar's own trigger -
// not shared/exported there, so duplicated here, matching this app's
// existing convention of small local icon components per file.
function KebabIcon() {
  return (
    <svg viewBox="0 -960 960 960" width="16" height="16" aria-hidden="true">
      <path
        d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"
        fill="currentColor"
      />
    </svg>
  );
}

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

// The card itself is a <button> (opens Look Detail), so the menu
// trigger has to be a sibling rather than nested inside it - same
// reason CollectionsView's own delete button sits beside its card
// button instead of inside it. Also keeps the menu from being clipped
// by the card's own overflow: hidden (used for the collage's corners).
function LookCard({ look, onClick, onRequestRemove }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef(null);
  // Only pieces currently styled on the bed count/show here - a Look's
  // catalog (every Collection piece) is no longer the same thing as
  // what's actually arranged, so look.wishitems.length would overcount.
  const placedPieces = look.wishitems.filter((piece) => piece.isPlaced);
  const pieceCount = placedPieces.length;

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    // mousedown (not click) so a second click on the trigger itself can
    // toggle-close via its own handler, same reasoning as
    // CollectionSavePopover's outside-click listener.
    function handlePointerDown(event) {
      if (wrapperRef.current?.contains(event.target)) return;
      setIsMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="look-card-wrapper" ref={wrapperRef}>
      <button type="button" className="look-card" onClick={onClick}>
        <LookCollage pieces={placedPieces} />

        <div className="look-card__meta">
          <p className="look-card__name">{look.name}</p>
          <p className="look-card__count">
            {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
          </p>
        </div>
      </button>

      <div className="look-card__menu">
        <button
          type="button"
          className="look-card__menu-trigger"
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label={`More options for ${look.name}`}
        >
          <KebabIcon />
        </button>

        {isMenuOpen && (
          <div className="look-card-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="look-card-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(false);
                onRequestRemove(look);
              }}
            >
              remove look ♡
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LookCard;
