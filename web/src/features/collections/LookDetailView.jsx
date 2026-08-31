import { useEffect, useMemo, useRef, useState } from "react";
import AddPiecesModal from "./AddPiecesModal";
import "./LookDetailView.css";

// Detail preview caps at more pieces than LookCard's compact collage
// (4) since there's far more room here - this is the planning surface,
// not the browsing thumbnail.
const MAX_BED_PIECES = 5;

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
};

function getDefaultPosition(count, index) {
  return DEFAULT_POSITIONS[count]?.[index] ?? { x: 0.4, y: 0.4 };
}

// Mirrors LookDetailView.css's own per-count/index `transform:
// rotate()` values. Only needed so the live "held" preview can compose
// "keep the existing rotation, then translate by the move delta"
// without the two fighting over the single `transform` property.
const ROTATIONS = {
  1: [-2],
  2: [-5, 4],
  3: [-2, -7, 6],
  4: [-2, -8, 5, 2],
  5: [-3, -8, 5, 2, 9],
};

function getRotation(count, index) {
  return ROTATIONS[count]?.[index] ?? 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildDefaultPositions(pieces) {
  const visible = pieces.slice(0, MAX_BED_PIECES);
  const seed = {};

  visible.forEach((piece, index) => {
    seed[piece.id] = getDefaultPosition(visible.length, index);
  });

  return seed;
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
  const remaining = pieces.length - visiblePieces.length;

  return (
    <div className="look-bed">
      <div
        className={`look-bed__surface${heldPieceId ? " is-placing" : ""}`}
        data-bed-surface
        onClick={isEditMode ? onCanvasClick : undefined}
      >
        <img className="look-bed__image" src="bed.png" alt="" aria-hidden="true" />
        <img className="look-bed__avatar" src="avatar.png" alt="" aria-hidden="true" />

        {visiblePieces.length > 0 ? (
          <div className={`look-bed__pieces look-bed__pieces--${visiblePieces.length}`}>
            {visiblePieces.map((piece, index) => {
              const position = positions[piece.id] ?? getDefaultPosition(visiblePieces.length, index);
              const isHeld = heldPieceId === piece.id;

              return (
                <div
                  key={piece.id}
                  className={`look-bed__piece${isEditMode ? " is-editable" : ""}${isHeld ? " is-held" : ""}`}
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    zIndex: isHeld ? 10 : undefined,
                  }}
                  tabIndex={isEditMode ? 0 : undefined}
                  aria-label={isEditMode ? `Move ${piece.name}` : undefined}
                  onClick={
                    isEditMode
                      ? (event) => onPieceClick(event, piece, getRotation(visiblePieces.length, index))
                      : undefined
                  }
                  onKeyDown={isEditMode ? (event) => onKeyMove(event, piece) : undefined}
                >
                  <img src={piece.imageUrl} alt={piece.name} />

                  {remaining > 0 && index === visiblePieces.length - 1 && (
                    <span className="look-bed__more" aria-hidden="true">
                      +{remaining}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="look-bed__empty">no pieces in this look yet</p>
        )}
      </div>
    </div>
  );
}

function LookDetailView({
  look,
  collectionName,
  onBack,
  collectionPieces,
  onAddPieces,
  onRemovePiece,
  onSaveLayout,
}) {
  const [isAddPiecesModalOpen, setIsAddPiecesModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState("");

  // Edit Mode / arrangement state. draftPositions is the ONLY thing
  // moving a piece ever touches - Supabase doesn't hear about any of it
  // until "save look" succeeds.
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftPositions, setDraftPositions] = useState({});
  // Which piece is currently "picked up" and following the pointer -
  // click-to-pick-up / move freely / click-again-to-drop, rather than a
  // press-and-hold drag (which felt choppy - this avoids needing
  // continuous pointer capture on a held button entirely).
  const [heldPieceId, setHeldPieceId] = useState(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [saveLayoutError, setSaveLayoutError] = useState("");
  // Snapshot taken the moment Edit Mode is entered - compared against
  // the live draft to decide whether Save has anything to do. State
  // (not a ref) since it's read during render for that comparison.
  const [initialPositions, setInitialPositions] = useState({});
  // Live-hold math (not reactive - written on pick-up, read on every
  // pointermove while held, cleared on drop; doesn't need to trigger
  // renders). While a piece is held, its DOM node is moved directly via
  // `transform` - draftPositions only gets a single update, on drop.
  const holdStateRef = useRef(null);

  const pieceCount = look.wishitems.length;

  // View Mode reads each piece's own saved position; a piece that's
  // never been arranged (existing Looks before this feature, or a
  // freshly Added piece) simply has none, and LookBed already falls
  // back to the deterministic default for anything missing here.
  const savedPositions = useMemo(() => {
    const map = {};
    look.wishitems.slice(0, MAX_BED_PIECES).forEach((piece) => {
      if (piece.position) {
        map[piece.id] = piece.position;
      }
    });
    return map;
  }, [look.wishitems]);

  const bedPositions = isEditMode ? draftPositions : savedPositions;
  const hasUnsavedChanges =
    JSON.stringify(draftPositions) !== JSON.stringify(initialPositions);

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

    // Composed as translate-then-rotate (applied right-to-left to the
    // element) so the piece keeps its existing in-place rotation and is
    // then shifted by a plain screen-space pixel offset.
    held.element.style.transform =
      `translate(${leftPx - held.originLeftPx}px, ${topPx - held.originTopPx}px) rotate(${held.rotationDeg}deg)`;
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

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        cancelHold();
      }
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
      [held.pieceId]: { x, y },
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

  function handlePieceClick(event, piece, rotationDeg) {
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

  function handleEnterEditMode() {
    const visibleCount = Math.min(pieceCount, MAX_BED_PIECES);
    const seed = {};

    look.wishitems.slice(0, MAX_BED_PIECES).forEach((piece, index) => {
      seed[piece.id] = piece.position ?? getDefaultPosition(visibleCount, index);
    });

    setDraftPositions(seed);
    setInitialPositions(seed);
    setSaveLayoutError("");
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    cancelHold();
    setIsEditMode(false);
    setDraftPositions({});
    setSaveLayoutError("");
  }

  function handleResetArrangement() {
    cancelHold();
    setDraftPositions(buildDefaultPositions(look.wishitems));
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
      positionsToSave = { ...draftPositions, [held.pieceId]: { x, y } };

      held.element.style.transform = "";
      holdStateRef.current = null;
      setHeldPieceId(null);
      setDraftPositions(positionsToSave);
    }

    setIsSavingLayout(true);
    setSaveLayoutError("");

    const positions = Object.entries(positionsToSave).map(([wishitemId, position]) => ({
      wishitemId,
      x: position.x,
      y: position.y,
    }));

    const result = await onSaveLayout(positions);

    if (result.success) {
      setIsEditMode(false);
      setDraftPositions({});
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
      <button type="button" className="look-detail__back" onClick={handleBackClick}>
        ← {collectionName}
      </button>

      <h2 className="look-detail__title">{look.name} ♡</h2>

      {isEditMode && (
        <p className="look-detail__edit-hint">
          {heldPieceId
            ? "move it, then click again to drop ♡"
            : "editing arrangement ♡ click a piece to pick it up"}
        </p>
      )}

      <div className="look-detail__layout">
        <div className="look-detail__canvas">
          <LookBed
            pieces={look.wishitems}
            isEditMode={isEditMode}
            positions={bedPositions}
            heldPieceId={heldPieceId}
            onPieceClick={handlePieceClick}
            onCanvasClick={handleCanvasClick}
            onKeyMove={handleKeyMove}
          />
        </div>

        {/* Secondary to the bed - compact thumbnails, not ProductCards.
            Placed pieces stay listed here too; this is the reference
            inventory, not something arranging consumes. */}
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
                    disabled={removingId === piece.id || isEditMode}
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
            disabled={isEditMode}
          >
            + add pieces ♡
          </button>
        </div>
      </div>

      {isEditMode ? (
        <div className="look-detail__edit-toolbar">
          <button
            type="button"
            className="look-detail__button"
            onClick={handleCancelEdit}
            disabled={isSavingLayout}
          >
            cancel
          </button>

          <button
            type="button"
            className="look-detail__button"
            onClick={handleResetArrangement}
            disabled={isSavingLayout}
          >
            reset arrangement
          </button>

          <button
            type="button"
            className="look-detail__button look-detail__button--primary"
            onClick={handleSaveArrangement}
            disabled={isSavingLayout || !hasUnsavedChanges}
          >
            {isSavingLayout ? "saving..." : "save look ♡"}
          </button>
        </div>
      ) : (
        <button type="button" className="look-detail__button look-detail__edit" onClick={handleEnterEditMode}>
          edit arrangement ♡
        </button>
      )}

      {saveLayoutError && <p className="look-detail__panel-error look-detail__save-error">{saveLayoutError}</p>}

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
