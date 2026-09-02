import { useEffect, useMemo, useRef, useState } from "react";
import PreparePieceModal from "../wishlist/PreparePieceModal";
import IllustrateLookModal from "./IllustrateLookModal";
import { AVATAR_SRC } from "./looks";
import { categorizeProduct } from "../../lib/categorize";
import "./LookDetailView.css";

// Detail preview caps at more pieces than LookCard's compact collage
// (4) since there's far more room here - this is the planning surface,
// not the browsing thumbnail. Also mirrored server-side as MAX_PIECES
// in supabase/functions/illustrate-look/index.ts - keep both in sync,
// since a bed that allows more pieces than the generation endpoint
// accepts would let a fully-styled Look fail Illustrate Look outright.
const MAX_BED_PIECES = 8;

// How far one arrow-key press nudges a piece, as a fraction of the bed
// canvas's own width/height.
const KEYBOARD_STEP = 0.02;

// Mirrors the deterministic top-left placements this view used before
// dragging existed, now as data instead of hardcoded CSS percentages -
// both the view-mode fallback (no saved position yet) and Edit Mode's
// "reset arrangement" read from this same table. Width/height/rotation
// stay in LookDetailView.css, keyed by count + DOM order exactly as
// before; only position (top-left corner, as a 0-1 fraction of the bed
// canvas) is ever movable or persisted.
const DEFAULT_POSITIONS = {
  1: [{ x: 0.32, y: 0.4 }],
  2: [
    { x: 0.14, y: 0.44 },
    { x: 0.54, y: 0.42 },
  ],
  3: [
    { x: 0.33, y: 0.34 },
    { x: 0.12, y: 0.66 },
    { x: 0.6, y: 0.64 },
  ],
  4: [
    { x: 0.34, y: 0.32 },
    { x: 0.12, y: 0.6 },
    { x: 0.56, y: 0.56 },
    { x: 0.39, y: 0.83 },
  ],
  5: [
    { x: 0.3, y: 0.3 },
    { x: 0.1, y: 0.58 },
    { x: 0.54, y: 0.56 },
    { x: 0.38, y: 0.82 },
    { x: 0.62, y: 0.34 },
  ],
  // x/y stay within the same envelope the 1-5 slots above already
  // proved safe (roughly x: 0.1-0.62, y: 0.3-0.83) - bed.png's own
  // drawn comforter artwork has transparent padding baked into the
  // file, so a piece can sit inside the (square, clipped) bed surface
  // yet still visually land outside the drawn bed if its anchor pushes
  // much past that range - packing 6-8 slots tighter within the same
  // proven bounds instead of widening them.
  6: [
    { x: 0.3, y: 0.22 },
    { x: 0.1, y: 0.4 },
    { x: 0.5, y: 0.24 },
    { x: 0.12, y: 0.62 },
    { x: 0.36, y: 0.58 },
    { x: 0.58, y: 0.54 },
  ],
  7: [
    { x: 0.28, y: 0.2 },
    { x: 0.1, y: 0.36 },
    { x: 0.48, y: 0.22 },
    { x: 0.12, y: 0.56 },
    { x: 0.3, y: 0.52 },
    { x: 0.52, y: 0.5 },
    { x: 0.6, y: 0.3 },
  ],
  8: [
    { x: 0.26, y: 0.2 },
    { x: 0.1, y: 0.34 },
    { x: 0.46, y: 0.2 },
    { x: 0.12, y: 0.52 },
    { x: 0.28, y: 0.5 },
    { x: 0.46, y: 0.48 },
    { x: 0.6, y: 0.28 },
    { x: 0.6, y: 0.64 },
  ],
};

function getDefaultPosition(count, index) {
  return DEFAULT_POSITIONS[count]?.[index] ?? { x: 0.4, y: 0.4 };
}

// Mirrors LookDetailView.css's old per-count/index `transform:
// rotate()` values. Only needed so the live "held" preview can compose
// "keep the existing rotation, then translate by the move delta"
// without the two fighting over the single `transform` property.
const ROTATIONS = {
  1: [-2],
  2: [-5, 4],
  3: [-2, -7, 6],
  4: [-2, -8, 5, 2],
  5: [-3, -8, 5, 2, 9],
  6: [-3, -9, 4, -6, 3, 8],
  7: [-4, -9, 5, -7, 2, 9, -2],
  8: [-4, -9, 5, -7, 2, 9, -2, 6],
};

function getRotation(count, index) {
  return ROTATIONS[count]?.[index] ?? 0;
}

// Mirrors LookDetailView.css's old per-count/index width/height values -
// width is still the "size dial" the resize toolbar adjusts, but height
// is only a fallback used until a piece's real image has loaded; once
// its natural aspect ratio is known, height is derived from that
// instead, so the piece's own box hugs its actual shape (no leftover
// transparent letterboxing around a cutout to click/drag through).
const SIZES = {
  1: [{ width: 36, height: 40 }],
  2: [
    { width: 30, height: 34 },
    { width: 30, height: 34 },
  ],
  3: [
    { width: 30, height: 28 },
    { width: 24, height: 22 },
    { width: 24, height: 24 },
  ],
  4: [
    { width: 28, height: 26 },
    { width: 24, height: 22 },
    { width: 26, height: 26 },
    { width: 20, height: 12 },
  ],
  5: [
    { width: 22, height: 24 },
    { width: 22, height: 22 },
    { width: 24, height: 24 },
    { width: 18, height: 11 },
    { width: 16, height: 16 },
  ],
  6: [
    { width: 20, height: 22 },
    { width: 20, height: 20 },
    { width: 22, height: 22 },
    { width: 16, height: 10 },
    { width: 18, height: 18 },
    { width: 14, height: 14 },
  ],
  7: [
    { width: 19, height: 21 },
    { width: 19, height: 19 },
    { width: 20, height: 20 },
    { width: 15, height: 9 },
    { width: 17, height: 17 },
    { width: 13, height: 13 },
    { width: 15, height: 15 },
  ],
  8: [
    { width: 18, height: 20 },
    { width: 18, height: 18 },
    { width: 19, height: 19 },
    { width: 14, height: 9 },
    { width: 16, height: 16 },
    { width: 12, height: 12 },
    { width: 14, height: 14 },
    { width: 13, height: 13 },
  ],
};

function getSize(count, index) {
  return SIZES[count]?.[index] ?? { width: 24, height: 24 };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// wishitems.price is a real numeric column (arrives as a JS number, or
// null when unknown) - the string/empty-string cases are only handled
// defensively in case that ever changes upstream, not because live
// data currently needs it.
function parsePrice(price) {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price === "string" && price.trim() !== "") {
    const parsed = Number.parseFloat(price.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Sums only the pieces that actually have a usable price - unpriced
// pieces are silently skipped rather than treated as $0, and the total
// is null (not 0) only when NOT ONE placed piece has a usable price.
function calculateFitTotal(pieces) {
  const prices = pieces.map((piece) => parsePrice(piece.price)).filter((price) => price != null);
  if (prices.length === 0) return null;
  return prices.reduce((sum, price) => sum + price, 0);
}

// Persisted in look_items.scale alongside x/y (1 = normal size) - kept
// in the same position object throughout so Cancel/Reset/hold-and-drop
// all treat position and size consistently as one unit.
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const SCALE_STEP = 0.1;

// Catalog filters reuse the app's existing name-keyword categorizer
// (lib/categorize.js) - no persisted category data exists or is being
// added here. "Dresses" folds into "top" and "Other" only shows under
// "all", since the ask was four broad buckets, not one per raw category.
// ariaLabel doubles as the button's accessible name and hover title -
// the visible control is icon-only, so this is the only place the
// human-readable category name lives.
const CATALOG_FILTERS = [
  { key: "all", ariaLabel: "All pieces" },
  { key: "top", ariaLabel: "Tops" },
  { key: "bottom", ariaLabel: "Bottoms" },
  { key: "shoes", ariaLabel: "Shoes" },
  { key: "bags", ariaLabel: "Bags and accessories" },
];

function matchesFilter(piece, filterKey) {
  if (filterKey === "all") return true;

  const category = categorizeProduct(piece);
  if (filterKey === "top") return category === "Tops" || category === "Dresses";
  if (filterKey === "bottom") return category === "Bottoms";
  if (filterKey === "shoes") return category === "Shoes";
  if (filterKey === "bags") return category === "Bags" || category === "Accessories";
  return true;
}

// No icon library is installed in this project, so these are hand-rolled
// inline SVGs (same "small local icon component" convention LookCard.jsx
// already uses for its own kebab icon) rather than pulling in a whole
// icon package for five glyphs. Simple stroke-based outlines, 20x20,
// currentColor so the circular button's own text color drives them.
function CategoryIcon({ filterKey }) {
  const common = { viewBox: "0 0 20 20", width: 18, height: 18, "aria-hidden": true };

  if (filterKey === "all") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M10 17.2 3.6 11c-2-1.9-2-5 0-6.9 1.9-1.8 4.9-1.7 6.7.2l.3.3.3-.3c1.8-1.9 4.8-2 6.7-.2 2 1.9 2 5 0 6.9L10 17.2Z" />
      </svg>
    );
  }

  if (filterKey === "top") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M7 3 4 5.2 2.5 8.6l2.3 1.3L6 8v8.5c0 .3.2.5.5.5h7c.3 0 .5-.2.5-.5V8l1.2 1.9 2.3-1.3L16 5.2 13 3c-.6.9-1.7 1.5-3 1.5S7.6 3.9 7 3Z" />
      </svg>
    );
  }

  if (filterKey === "bottom") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M6 3h8l.6 6.5.9 7a.5.5 0 0 1-.5.5h-2.3a.5.5 0 0 1-.5-.4L11 10l-1.2 6.6a.5.5 0 0 1-.5.4H7a.5.5 0 0 1-.5-.5l.9-7L6 3Z" />
        <path d="M6 6.3h8" />
      </svg>
    );
  }

  if (filterKey === "shoes") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M3 15.5V11c1 .6 2 .3 2.6-.5L7.8 7c.5-.7 1.4-1 2.2-.7l2 .8v3.2c0 .8.5 1.5 1.2 1.8l3.3 1.4c.6.3 1 .9 1 1.5v.5H3Z" />
      </svg>
    );
  }

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M6.5 7h7l.8 9a.8.8 0 0 1-.8.9H6.5a.8.8 0 0 1-.8-.9l.8-9Z" />
      <path d="M8 7V5.5a2 2 0 0 1 4 0V7" />
    </svg>
  );
}

// Deterministic, count-based placement over the real bed photo when no
// position is saved/drafted yet. In Edit Mode, clicking a piece "picks
// it up" (see LookDetailView's holdStateRef) - it then follows the
// pointer until clicked again or the bed background is clicked, with
// an arrow-key fallback for keyboard/non-pointer input.
function LookBed({
  pieces,
  isEditMode,
  positions,
  heldPieceId,
  onPieceClick,
  onCanvasClick,
  onKeyMove,
}) {
  const visiblePieces = pieces.slice(0, MAX_BED_PIECES);
  // naturalHeight/naturalWidth per piece, filled in as each image
  // finishes loading - until then, boxes use the deterministic
  // width/height guess from SIZES as a placeholder.
  const [aspectRatios, setAspectRatios] = useState({});

  function handleImageLoad(pieceId, event) {
    const { naturalWidth, naturalHeight } = event.target;
    if (!naturalWidth || !naturalHeight) return;

    const ratio = naturalHeight / naturalWidth;
    setAspectRatios((current) => (current[pieceId] === ratio ? current : { ...current, [pieceId]: ratio }));
  }

  return (
    <div className="look-bed">
      <div
        className={`look-bed__surface${heldPieceId ? " is-placing" : ""}`}
        data-bed-surface
        onClick={isEditMode ? onCanvasClick : undefined}
      >
        <img className="look-bed__image" src="bed.png" alt="" aria-hidden="true" />
        <img className="look-bed__avatar" src={AVATAR_SRC} alt="" aria-hidden="true" />

        {visiblePieces.length > 0 ? (
          <div className={`look-bed__pieces look-bed__pieces--${visiblePieces.length}`}>
            {visiblePieces.map((piece, index) => {
              const position = positions[piece.id] ?? getDefaultPosition(visiblePieces.length, index);
              const isHeld = heldPieceId === piece.id;
              const rotationDeg = getRotation(visiblePieces.length, index);
              const scale = position.scale ?? DEFAULT_SCALE;

              const baseSize = getSize(visiblePieces.length, index);
              const ratio = aspectRatios[piece.id];
              const widthPercent = baseSize.width;
              // Height follows the image's own real proportions once
              // known, instead of a fixed guess - this is what makes the
              // box hug the item's actual shape rather than leaving
              // transparent padding around a cutout.
              const heightPercent = ratio ? widthPercent * ratio : baseSize.height;

              return (
                <div
                  key={piece.id}
                  className={`look-bed__piece${isEditMode ? " is-editable" : ""}${isHeld ? " is-held" : ""}`}
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`,
                    // Not set while actively held - applyHoldFrame owns
                    // this element's transform directly during a drag.
                    transform: isHeld ? undefined : `rotate(${rotationDeg}deg) scale(${scale})`,
                    zIndex: isHeld ? 10 : undefined,
                  }}
                  tabIndex={isEditMode ? 0 : undefined}
                  aria-label={isEditMode ? `Move ${piece.name}` : undefined}
                  onClick={
                    isEditMode
                      ? (event) => onPieceClick(event, piece, rotationDeg, scale)
                      : undefined
                  }
                  onKeyDown={isEditMode ? (event) => onKeyMove(event, piece) : undefined}
                >
                  <img
                    src={piece.cutoutImageUrl ?? piece.imageUrl}
                    alt={piece.name}
                    onLoad={(event) => handleImageLoad(piece.id, event)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="look-bed__empty">
            <p className="look-bed__empty-title">style your look ♡</p>
            <p className="look-bed__empty-subtitle">pick something from my pieces →</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper mirrors LookCard's own pattern: the tile itself is a <button>
// (click-to-place-on-bed in Edit Mode), so the ••• trigger has to be a
// sibling rather than nested inside it.
function CatalogTile({ piece, isPlaced, isEditMode, onToggle, onPrepare }) {
  const hasCutout = Boolean(piece.cutoutImageUrl);

  return (
    <div className="look-studio__tile-wrapper">
      <button
        type="button"
        className={`look-studio__tile${isPlaced ? " is-placed" : ""}`}
        onClick={isEditMode ? () => onToggle(piece) : undefined}
        disabled={!isEditMode}
        aria-pressed={isEditMode ? isPlaced : undefined}
        title={piece.name}
      >
        <img
          className={`look-studio__tile-image${hasCutout ? " has-cutout" : ""}`}
          src={piece.cutoutImageUrl ?? piece.imageUrl}
          alt={piece.name}
        />
        {/* Plain indicator dot, not a heart - only communicates "this is
            currently on the bed", nothing decorative. */}
        {isPlaced && (
          <span className="look-studio__tile-badge" aria-hidden="true" />
        )}
      </button>

      {/* Sibling of the tile button (not nested inside it) for the same
          reason LookCard's own overflow trigger is a sibling - a button
          can't nest inside another button. Direct action, not a
          dropdown - with "remove from look" gone (every Collection
          piece is always in the catalog now), Prepare Piece is the only
          secondary action left on a piece. */}
      <button
        type="button"
        className="look-studio__tile-prepare"
        onClick={(event) => {
          event.stopPropagation();
          onPrepare(piece);
        }}
        disabled={isEditMode}
        aria-label={hasCutout ? `Edit cutout for ${piece.name}` : `Prepare ${piece.name}`}
        title={hasCutout ? "edit cutout" : "prepare piece"}
      >
        ✎
      </button>
    </div>
  );
}

// The Look Studio layout's left zone. One clickable frame that's
// either the saved illustration (click -> IllustrateLookModal, which
// already renders its own "saved" phase - image + Close, no
// regeneration risk) or, with no saved illustration yet, the
// generation entry point (click -> the same modal's "form" phase).
// Deliberately no title/date/piece-count/status text here - just the
// image (or empty state) and, below it, the fit total.
const ILLUSTRATE_EMPTY_ASSET = "illustrate-look-empty.png";

function IllustrationColumn({ illustrationUrl, fitTotal, onOpen }) {
  const formattedTotal = fitTotal == null ? "—" : `$${fitTotal.toFixed(2)}`;

  return (
    <div className="look-studio__illustration-column">
      <button
        type="button"
        className={`look-studio__illustration-frame${illustrationUrl ? "" : " look-studio__illustration-frame--empty"}`}
        onClick={onOpen}
        aria-label={illustrationUrl ? "View saved fashion illustration" : "Illustrate this look"}
      >
        {illustrationUrl ? (
          <img className="look-studio__illustration-image" src={illustrationUrl} alt="" />
        ) : (
          <img className="look-studio__illustration-empty-asset" src={ILLUSTRATE_EMPTY_ASSET} alt="" />
        )}
      </button>

      <div className="look-studio__fit-total">
        <p
          className="look-studio__fit-total-label"
          title="Based on saved prices for pieces currently in this look."
        >
          est. fit total
        </p>
        <p className="look-studio__fit-total-value">{formattedTotal}</p>
      </div>
    </div>
  );
}

function LookDetailView({
  look,
  collectionName,
  onBack,
  collectionPieces,
  onSaveLayout,
  onPrepareCutout,
  onSaveIllustration,
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [catalogNotice, setCatalogNotice] = useState("");
  // The piece currently open in Prepare Piece, or null - a fresh mount
  // of the modal each time, same pattern as every other modal here.
  const [preparingPiece, setPreparingPiece] = useState(null);
  // Illustrate Look's prep/confirmation modal - just an open/closed
  // flag, same pattern as preparingPiece. No separate "which pieces are
  // styled" state; the modal is handed bedPieces directly (see below).
  const [isIllustrateModalOpen, setIsIllustrateModalOpen] = useState(false);

  // Edit Mode / arrangement state. draftPositions/draftPlacedIds are the
  // ONLY things moving or placing a piece ever touch - Supabase doesn't
  // hear about any of it until "save look" succeeds.
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftPositions, setDraftPositions] = useState({});
  const [draftPlacedIds, setDraftPlacedIds] = useState(new Set());
  // Which piece is currently "picked up" and following the pointer -
  // click-to-pick-up / move freely / click-again-to-drop, rather than a
  // press-and-hold drag (which felt choppy - this avoids needing
  // continuous pointer capture on a held button entirely).
  const [heldPieceId, setHeldPieceId] = useState(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [saveLayoutError, setSaveLayoutError] = useState("");
  // Snapshots taken the moment Edit Mode is entered - compared against
  // the live draft to decide whether Save has anything to do. State
  // (not refs) since they're read during render for that comparison.
  const [initialPositions, setInitialPositions] = useState({});
  const [initialPlacedIds, setInitialPlacedIds] = useState(new Set());
  // Live-hold math (not reactive - written on pick-up, read on every
  // pointermove while held, cleared on drop; doesn't need to trigger
  // renders). While a piece is held, its DOM node is moved directly via
  // `transform` - draftPositions only gets a single update, on drop.
  const holdStateRef = useRef(null);

  // "my pieces" is automatically every piece in the parent Collection -
  // no separate "add pieces to this Look" step exists anymore. Catalog
  // membership and bed placement are deliberately separate concepts:
  // being in the Collection is enough to show up here; only look_items
  // (isPlaced) determines what's actually styled on the bed.
  const catalogPieces = useMemo(
    () => collectionPieces.filter((piece) => matchesFilter(piece, activeFilter)),
    [collectionPieces, activeFilter],
  );

  // Looks up a Collection piece's saved isPlaced/position, if it has
  // ever been placed (i.e. has its own look_items row) - most Collection
  // pieces won't, and that's fine, they just default to "not placed".
  const lookPieceById = useMemo(() => {
    const map = new Map();
    look.wishitems.forEach((piece) => map.set(piece.id, piece));
    return map;
  }, [look.wishitems]);

  // View Mode reads each piece's own saved position/placement; a piece
  // that's never been arranged simply has none, and LookBed already
  // falls back to the deterministic default for anything missing here.
  const savedPositions = useMemo(() => {
    const map = {};
    look.wishitems
      .filter((piece) => piece.isPlaced)
      .slice(0, MAX_BED_PIECES)
      .forEach((piece) => {
        if (piece.position) {
          map[piece.id] = piece.position;
        }
      });
    return map;
  }, [look.wishitems]);

  const bedPieces = useMemo(() => {
    if (isEditMode) {
      // Sourced from collectionPieces, not look.wishitems - a piece
      // placed for the very first time this session has no look_items
      // row yet, so it wouldn't exist in look.wishitems at all.
      return collectionPieces.filter((piece) => draftPlacedIds.has(piece.id));
    }
    return look.wishitems.filter((piece) => piece.isPlaced);
  }, [collectionPieces, look.wishitems, isEditMode, draftPlacedIds]);

  const bedPositions = isEditMode ? draftPositions : savedPositions;
  // Reuses bedPieces (the same "currently placed" list the bed itself
  // renders from) rather than a second placed-state computation - live
  // during Edit Mode too, so the total updates as pieces are added/
  // removed, same immediacy as the bed itself.
  const fitTotal = useMemo(() => calculateFitTotal(bedPieces), [bedPieces]);
  const hasUnsavedChanges =
    JSON.stringify(draftPositions) !== JSON.stringify(initialPositions) ||
    JSON.stringify([...draftPlacedIds].sort()) !== JSON.stringify([...initialPlacedIds].sort());

  // Runs at most once per animation frame while something is held.
  // Moves the piece by directly writing its `transform` - no React
  // state, no re-render, no reconciliation of the rest of the bed.
  function applyHoldFrame() {
    const held = holdStateRef.current;
    if (!held) return;

    held.rafId = null;

    const deltaX = held.latestClientX - held.startClientX;
    const deltaY = held.latestClientY - held.startClientY;

    const leftPx = clamp(held.originLeftPx + deltaX, 0, held.canvasRect.width - held.pieceWidth);
    const topPx = clamp(held.originTopPx + deltaY, 0, held.canvasRect.height - held.pieceHeight);

    held.finalLeftPx = leftPx;
    held.finalTopPx = topPx;

    // Composed as translate-then-rotate-then-scale (applied right-to-left
    // to the element) so the piece keeps its existing in-place rotation
    // and size, and is then shifted by a plain screen-space pixel offset.
    held.element.style.transform =
      `translate(${leftPx - held.originLeftPx}px, ${topPx - held.originTopPx}px) rotate(${held.rotationDeg}deg) scale(${held.scale})`;
  }

  // Tracks the pointer globally (not just over the piece) so the held
  // piece keeps following even if the cursor moves faster than the
  // piece itself, or briefly leaves the bed. Escape cancels the pick-up
  // without committing anything.
  useEffect(() => {
    if (!heldPieceId) return undefined;

    function handlePointerMove(event) {
      const held = holdStateRef.current;
      if (!held) return;

      held.latestClientX = event.clientX;
      held.latestClientY = event.clientY;

      if (held.rafId == null) {
        held.rafId = requestAnimationFrame(applyHoldFrame);
      }
    }

    // "-" and "=" share a physical key with "+" on most keyboards, so
    // both are bound (no Shift needed) - only "+" is shown to the user
    // as the grow shortcut since that's the intuitive symbol for it.
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        cancelHold();
      } else if (event.key === "-") {
        event.preventDefault();
        handleScaleChange(-SCALE_STEP);
      } else if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        handleScaleChange(SCALE_STEP);
      }
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // handleScaleChange/cancelHold only ever touch holdStateRef, not
    // reactive state directly - re-subscribing these listeners on every
    // render (which including them here would cause) buys nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldPieceId]);

  useEffect(() => {
    return () => {
      if (holdStateRef.current?.rafId != null) {
        cancelAnimationFrame(holdStateRef.current.rafId);
      }
    };
  }, []);

  // Finalizes the held piece's current followed position into
  // draftPositions (a normal "drop").
  function commitHold() {
    const held = holdStateRef.current;
    if (!held) return;

    if (held.rafId != null) {
      cancelAnimationFrame(held.rafId);
    }

    const x = held.finalLeftPx / held.canvasRect.width;
    const y = held.finalTopPx / held.canvasRect.height;

    held.element.style.transform = "";
    holdStateRef.current = null;
    setHeldPieceId(null);

    setDraftPositions((current) => ({
      ...current,
      [held.pieceId]: { x, y, scale: held.scale },
    }));
  }

  // Abandons the pick-up entirely - the piece snaps back to wherever it
  // was before being picked up, nothing is written to draftPositions.
  function cancelHold() {
    const held = holdStateRef.current;
    if (!held) return;

    if (held.rafId != null) {
      cancelAnimationFrame(held.rafId);
    }

    held.element.style.transform = "";
    holdStateRef.current = null;
    setHeldPieceId(null);
  }

  function handlePieceClick(event, piece, rotationDeg, scale) {
    event.stopPropagation();

    if (holdStateRef.current) {
      // Clicking the held piece again drops it; clicking a different
      // one just drops whatever was held (it doesn't also pick up the
      // new one, to keep pick-up/drop unambiguous - a second click on
      // the new piece picks it up normally).
      commitHold();
      return;
    }

    const pieceEl = event.currentTarget;
    const canvasEl = pieceEl.closest("[data-bed-surface]");
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const pieceRect = pieceEl.getBoundingClientRect();
    const originLeftPx = pieceRect.left - canvasRect.left;
    const originTopPx = pieceRect.top - canvasRect.top;

    holdStateRef.current = {
      pieceId: piece.id,
      element: pieceEl,
      rotationDeg,
      scale,
      canvasRect,
      pieceWidth: pieceRect.width,
      pieceHeight: pieceRect.height,
      originLeftPx,
      originTopPx,
      startClientX: event.clientX,
      startClientY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      finalLeftPx: originLeftPx,
      finalTopPx: originTopPx,
      rafId: null,
    };

    setHeldPieceId(piece.id);
  }

  function handleCanvasClick() {
    if (holdStateRef.current) {
      commitHold();
    }
  }

  // Only ever called for the currently-held piece (the resize toolbar
  // only renders while one is held) - mutates the live hold state
  // directly and repaints immediately, same as a pointer move would,
  // rather than going through draftPositions until the piece is dropped.
  function handleScaleChange(delta) {
    const held = holdStateRef.current;
    if (!held) return;

    held.scale = clamp(held.scale + delta, MIN_SCALE, MAX_SCALE);
    applyHoldFrame();
  }

  // Click on a "my pieces" catalog tile in Edit Mode - toggles whether
  // it's currently styled on the bed. Look membership (look_items row)
  // is never touched here; only draftPlacedIds/draftPositions change,
  // exactly like moving a piece only touches draftPositions.
  function handleTogglePlacement(piece) {
    setCatalogNotice("");

    if (draftPlacedIds.has(piece.id)) {
      setDraftPlacedIds((current) => {
        const next = new Set(current);
        next.delete(piece.id);
        return next;
      });
      return;
    }

    if (draftPlacedIds.size >= MAX_BED_PIECES) {
      setCatalogNotice("your bed is full - remove a piece first");
      return;
    }

    const nextPlacedIds = new Set(draftPlacedIds);
    nextPlacedIds.add(piece.id);

    // Ordered the same way LookBed will actually render them (by the
    // Collection's own item order, since bedPieces is sourced from
    // collectionPieces in Edit Mode), so the default position assigned
    // here matches the size/rotation slot the piece will really end up
    // in - including for a piece with no look_items row yet.
    const orderedPlaced = collectionPieces.filter((item) => nextPlacedIds.has(item.id));
    const newCount = orderedPlaced.length;
    const newIndex = orderedPlaced.findIndex((item) => item.id === piece.id);

    setDraftPlacedIds(nextPlacedIds);
    setDraftPositions((current) => {
      if (current[piece.id]) return current;
      return {
        ...current,
        [piece.id]: { ...getDefaultPosition(newCount, newIndex), scale: DEFAULT_SCALE },
      };
    });
  }

  function handleEnterEditMode() {
    const placed = look.wishitems.filter((piece) => piece.isPlaced).slice(0, MAX_BED_PIECES);
    const seed = {};
    const placedIds = new Set();

    placed.forEach((piece, index) => {
      const base = piece.position ?? getDefaultPosition(placed.length, index);
      seed[piece.id] = { ...base, scale: base.scale ?? DEFAULT_SCALE };
      placedIds.add(piece.id);
    });

    setDraftPositions(seed);
    setDraftPlacedIds(placedIds);
    setInitialPositions(seed);
    setInitialPlacedIds(placedIds);
    setSaveLayoutError("");
    setCatalogNotice("");
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    cancelHold();
    setIsEditMode(false);
    setDraftPositions({});
    setDraftPlacedIds(new Set());
    setSaveLayoutError("");
    setCatalogNotice("");
  }

  async function handleSaveArrangement() {
    // A piece mid-hold when Save is clicked shouldn't have its
    // in-progress move silently lost - fold it into the payload
    // directly rather than relying on the (async) state setter having
    // already landed by the time we read draftPositions below.
    const held = holdStateRef.current;
    let positionsToSave = draftPositions;

    if (held) {
      if (held.rafId != null) cancelAnimationFrame(held.rafId);
      const x = held.finalLeftPx / held.canvasRect.width;
      const y = held.finalTopPx / held.canvasRect.height;
      positionsToSave = { ...draftPositions, [held.pieceId]: { x, y, scale: held.scale } };

      held.element.style.transform = "";
      holdStateRef.current = null;
      setHeldPieceId(null);
      setDraftPositions(positionsToSave);
    }

    setIsSavingLayout(true);
    setSaveLayoutError("");

    // Pieces still placed get their full position/scale + isPlaced:true.
    // Pieces that WERE placed but got removed this session only send
    // isPlaced:false - their old x/y/scale are deliberately left alone
    // in the database (see updateLookLayout), so they reappear where
    // they were the next time they're placed again.
    const removedIds = [...initialPlacedIds].filter((id) => !draftPlacedIds.has(id));

    const positions = [
      ...[...draftPlacedIds].map((wishitemId) => {
        const position = positionsToSave[wishitemId] ?? { x: 0.4, y: 0.4, scale: DEFAULT_SCALE };
        return {
          wishitemId,
          x: position.x,
          y: position.y,
          scale: position.scale ?? DEFAULT_SCALE,
          isPlaced: true,
        };
      }),
      ...removedIds.map((wishitemId) => ({ wishitemId, isPlaced: false })),
    ];

    const result = positions.length > 0 ? await onSaveLayout(positions) : { success: true };

    if (result.success) {
      setIsEditMode(false);
      setDraftPositions({});
      setDraftPlacedIds(new Set());
    } else {
      setSaveLayoutError(result.error);
    }

    setIsSavingLayout(false);
  }

  function handleBackClick() {
    cancelHold();

    if (isEditMode && hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "Discard unsaved arrangement changes?",
      );
      if (!confirmDiscard) return;
    }

    onBack();
  }

  const ARROW_DELTAS = {
    ArrowUp: { x: 0, y: -KEYBOARD_STEP },
    ArrowDown: { x: 0, y: KEYBOARD_STEP },
    ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
    ArrowRight: { x: KEYBOARD_STEP, y: 0 },
  };

  function handleKeyMove(event, piece) {
    const delta = ARROW_DELTAS[event.key];
    if (!delta) return;

    event.preventDefault();

    const pieceEl = event.currentTarget;
    const canvasEl = pieceEl.closest("[data-bed-surface]");
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const pieceRect = pieceEl.getBoundingClientRect();
    const maxX = Math.max(0, 1 - pieceRect.width / canvasRect.width);
    const maxY = Math.max(0, 1 - pieceRect.height / canvasRect.height);

    setDraftPositions((current) => {
      const currentPosition = current[piece.id] ?? { x: 0, y: 0 };
      return {
        ...current,
        [piece.id]: {
          x: clamp(currentPosition.x + delta.x, 0, maxX),
          y: clamp(currentPosition.y + delta.y, 0, maxY),
        },
      };
    });
  }

  return (
    <div className="look-detail">
      <div className="look-studio__header">
        <button type="button" className="look-studio__back" onClick={handleBackClick}>
          ← {collectionName}
        </button>

        <div className="look-studio__title-group">
          <span className="look-studio__title">look studio</span>
          <span className="look-studio__title-sep" aria-hidden="true">|</span>
          <span className="look-studio__name">{look.name}</span>
        </div>

        {/* The header's 3rd grid column is intentionally left empty now -
            piece count moved out of the persistent chrome (see
            IllustrationColumn's fit total below, and section 13's "no
            piece-count repeated" direction). bedPieces.length is still
            computed above for everything that actually needs it
            (bed-full checks, etc.) - no DOM element needed here for an
            empty grid cell to still center .look-studio__title-group. */}
      </div>

      <div className="look-studio__body">
        <IllustrationColumn
          illustrationUrl={look.illustrationUrl}
          fitTotal={fitTotal}
          onOpen={() => setIsIllustrateModalOpen(true)}
        />

        <div className="look-detail__canvas">
          <LookBed
            pieces={bedPieces}
            isEditMode={isEditMode}
            positions={bedPositions}
            heldPieceId={heldPieceId}
            onPieceClick={handlePieceClick}
            onCanvasClick={handleCanvasClick}
            onKeyMove={handleKeyMove}
          />

          {/* Belongs to the bed, not the catalog - Edit Mode's own
              Cancel/Save toolbar. Illustrate Look no longer has a
              button here at all: the persistent left illustration
              column (see IllustrationColumn, rendered above) is now
              the single entry point for both viewing a saved
              illustration and generating a new one, so there's nothing
              for View Mode to show in this spot anymore. */}
          {isEditMode && (
            <div className="look-studio__bed-controls">
              <div className="look-detail__edit-toolbar">
                <button
                  type="button"
                  className="look-detail__button look-detail__button--ghost"
                  onClick={handleCancelEdit}
                  disabled={isSavingLayout}
                >
                  cancel
                </button>

                <button
                  type="button"
                  className="look-detail__button look-detail__button--primary"
                  onClick={handleSaveArrangement}
                  disabled={isSavingLayout || !hasUnsavedChanges}
                >
                  {isSavingLayout ? "saving..." : "save look"}
                </button>
              </div>
            </div>
          )}

          {heldPieceId && (
            <div className="look-detail__resize-toolbar">
              <span>size</span>
              <button
                type="button"
                onClick={() => handleScaleChange(-SCALE_STEP)}
                aria-label="Shrink selected piece"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => handleScaleChange(SCALE_STEP)}
                aria-label="Enlarge selected piece"
              >
                +
              </button>
              <span className="look-detail__resize-toolbar-hint">(− / + on your keyboard)</span>
            </div>
          )}

          {isEditMode && !heldPieceId && (
            <p className="look-studio__edit-hint">click a piece on the bed to move it, or click one in my pieces to add/remove it</p>
          )}

          {saveLayoutError && <p className="look-detail__panel-error look-detail__save-error">{saveLayoutError}</p>}
        </div>

        {/* The browseable catalog - every piece in the parent Collection,
            not just what's currently styled on the bed. Starts directly
            with the category toolbar (no "my pieces" title) so this
            reads as an inventory module, not a labeled content section. */}
        <div className="look-detail__panel">
          <div className="look-studio__filters" role="group" aria-label="Filter my pieces">
            {CATALOG_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`look-studio__filter${activeFilter === filter.key ? " is-active" : ""}`}
                aria-pressed={activeFilter === filter.key}
                aria-label={filter.ariaLabel}
                title={filter.ariaLabel}
                onClick={() => setActiveFilter(filter.key)}
              >
                <CategoryIcon filterKey={filter.key} />
              </button>
            ))}
          </div>

          <div className="look-studio__catalog-divider" aria-hidden="true" />

          {catalogNotice && <p className="look-studio__catalog-notice">{catalogNotice}</p>}

          {collectionPieces.length > 0 ? (
            catalogPieces.length > 0 ? (
              <div className="look-studio__catalog-grid">
                {catalogPieces.map((piece) => (
                  <CatalogTile
                    key={piece.id}
                    piece={piece}
                    isPlaced={
                      isEditMode
                        ? draftPlacedIds.has(piece.id)
                        : Boolean(lookPieceById.get(piece.id)?.isPlaced)
                    }
                    isEditMode={isEditMode}
                    onToggle={handleTogglePlacement}
                    onPrepare={setPreparingPiece}
                  />
                ))}
              </div>
            ) : (
              <p className="look-detail__panel-empty">nothing here yet</p>
            )
          ) : (
            <p className="look-detail__panel-empty">no pieces in this collection yet</p>
          )}

          {/* The panel's own entry point into Edit Mode - bigger and more
              visible than the old subtle link, since styling the look
              is the primary action this whole screen exists for. Only
              shown in View Mode; Edit Mode's own Cancel/Save toolbar
              stays with the bed (see .look-studio__bed-controls). */}
          {!isEditMode && (
            <div className="look-studio__panel-footer">
              <button
                type="button"
                className="look-studio__style-cta"
                onClick={handleEnterEditMode}
              >
                ✣ style look
              </button>
            </div>
          )}
        </div>
      </div>

      {preparingPiece && (
        <PreparePieceModal
          product={preparingPiece}
          onClose={() => setPreparingPiece(null)}
          onSave={(blob) => onPrepareCutout(preparingPiece.id, blob)}
        />
      )}

      {isIllustrateModalOpen && (
        <IllustrateLookModal
          look={look}
          pieces={bedPieces}
          onClose={() => setIsIllustrateModalOpen(false)}
          onSaveIllustration={onSaveIllustration}
        />
      )}
    </div>
  );
}

export default LookDetailView;
