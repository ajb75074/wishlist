import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import IllustrateLookModal from "./IllustrateLookModal";
import DiscardChangesModal from "./DiscardChangesModal";
import { useBedModel } from "../profile/useBedModel";
import { ALLOWED_PROFILE_IMAGE_TYPES } from "../profile/profile";
import { categorizeProduct } from "../../lib/categorize";
import shirtIcon from "../../assets/shirt.png";
import pantsIcon from "../../assets/pants.png";
import shoesIcon from "../../assets/shoes.png";
import bagIcon from "../../assets/bag.png";
import "./LookDetailView.css";

// Code-split: pulls in @huggingface/transformers (the in-browser SAM
// segmentation model), which would otherwise bloat the main bundle
// every visitor downloads even if they never open this modal.
const PreparePieceModal = lazy(() => import("../wishlist/PreparePieceModal"));

// Also mirrored server-side as MAX_PIECES in
// supabase/functions/illustrate-look/index.ts - keep both in sync, or
// a fully-styled bed could fail Illustrate Look outright.
const MAX_BED_PIECES = 8;

const KEYBOARD_STEP = 0.02;

// Fallback placement per piece count (0-1 fraction of the bed canvas), also
// used by Edit Mode's "reset arrangement".
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

// Hashed per piece, not per index, so tilt and size don't reshuffle when
// another piece is added or removed.
function hashPieceId(pieceId) {
  let hash = 0;
  for (let i = 0; i < pieceId.length; i++) {
    hash = (hash * 31 + pieceId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getRotation(pieceId) {
  return (hashPieceId(pieceId) % 19) - 9;
}

function getSize(pieceId) {
  const width = 16 + (hashPieceId(pieceId) % 15);
  return { width, height: width };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// price is a numeric column; the string cases are defensive only.
function parsePrice(price) {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price === "string" && price.trim() !== "") {
    const parsed = Number.parseFloat(price.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

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

const CATALOG_FILTERS = [
  { key: "all", label: "All", ariaLabel: "All items" },
  { key: "top", label: "Tops", ariaLabel: "Tops" },
  { key: "bottom", label: "Bottoms", ariaLabel: "Bottoms" },
  { key: "shoes", label: "Shoes", ariaLabel: "Shoes" },
  { key: "bags", label: "Other", ariaLabel: "Bags, accessories, and other items" },
];

function matchesFilter(piece, filterKey) {
  if (filterKey === "all") return true;

  const category = categorizeProduct(piece);
  if (filterKey === "top") return category === "Tops" || category === "Dresses";
  if (filterKey === "bottom") return category === "Bottoms";
  if (filterKey === "shoes") return category === "Shoes";
  if (filterKey === "bags") return category === "Bags" || category === "Accessories" || category === "Other";
  return true;
}

function CategoryIcon({ filterKey }) {
  if (filterKey === "all") {
    return (
      <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden="true" fill="currentColor">
        <path d="M10 17.2 3.6 11c-2-1.9-2-5 0-6.9 1.9-1.8 4.9-1.7 6.7.2l.3.3.3-.3c1.8-1.9 4.8-2 6.7-.2 2 1.9 2 5 0 6.9L10 17.2Z" />
      </svg>
    );
  }

  if (filterKey === "top") {
    return <img className="look-studio__filter-glyph" src={shirtIcon} alt="" aria-hidden="true" />;
  }

  if (filterKey === "bottom") {
    return <img className="look-studio__filter-glyph" src={pantsIcon} alt="" aria-hidden="true" />;
  }

  if (filterKey === "shoes") {
    return <img className="look-studio__filter-glyph" src={shoesIcon} alt="" aria-hidden="true" />;
  }

  return <img className="look-studio__filter-glyph" src={bagIcon} alt="" aria-hidden="true" />;
}

function LookBed({
  pieces,
  isEditMode,
  positions,
  heldPieceId,
  pieceZOrder,
  onPieceClick,
  onCanvasClick,
  onKeyMove,
  bedModelImageUrl,
  isUploadingAvatar,
  avatarUploadError,
  onUploadAvatar,
}) {
  const visiblePieces = pieces.slice(0, MAX_BED_PIECES);
  const [aspectRatios, setAspectRatios] = useState({});
  const avatarFileInputRef = useRef(null);

  function handleImageLoad(pieceId, event) {
    const { naturalWidth, naturalHeight } = event.target;
    if (!naturalWidth || !naturalHeight) return;

    const ratio = naturalHeight / naturalWidth;
    setAspectRatios((current) => (current[pieceId] === ratio ? current : { ...current, [pieceId]: ratio }));
  }

  function handleChooseAvatarPhoto() {
    avatarFileInputRef.current?.click();
  }

  async function handleAvatarFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    await onUploadAvatar(file);
  }

  return (
    <div className="look-bed">
      <div
        className={`look-bed__surface${heldPieceId ? " is-placing" : ""}`}
        data-bed-surface
        onClick={isEditMode ? onCanvasClick : undefined}
      >
        <img className="look-bed__image" src="bed.png" alt="" aria-hidden="true" />

        {bedModelImageUrl ? (
          <img className="look-bed__avatar" src={bedModelImageUrl} alt="" aria-hidden="true" />
        ) : (
          <div className="look-bed__avatar-placeholder">
            <input
              ref={avatarFileInputRef}
              type="file"
              accept={ALLOWED_PROFILE_IMAGE_TYPES.join(",")}
              onChange={handleAvatarFileSelected}
              disabled={isUploadingAvatar}
              hidden
            />
            <button
              type="button"
              className="look-bed__avatar-upload"
              onClick={handleChooseAvatarPhoto}
              disabled={isUploadingAvatar}
            >
              <span className="look-bed__avatar-upload-icon" aria-hidden="true">
                +
              </span>
              <span className="look-bed__avatar-upload-label">
                {isUploadingAvatar ? "uploading…" : "upload selfie"}
              </span>
            </button>
            {avatarUploadError && <p className="look-bed__avatar-upload-error">{avatarUploadError}</p>}
          </div>
        )}

        {visiblePieces.length > 0 ? (
          <div className={`look-bed__pieces look-bed__pieces--${visiblePieces.length}`}>
            {visiblePieces.map((piece, index) => {
              const position = positions[piece.id] ?? getDefaultPosition(visiblePieces.length, index);
              const isHeld = heldPieceId === piece.id;
              const rotationDeg = getRotation(piece.id);
              const scale = position.scale ?? DEFAULT_SCALE;

              const baseSize = getSize(piece.id);
              const ratio = aspectRatios[piece.id];
              const widthPercent = baseSize.width;
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
                    zIndex: isHeld ? 1000 : pieceZOrder.indexOf(piece.id) + 1,
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
        ) : null}
      </div>
    </div>
  );
}

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
        title={hasCutout ? "edit cutout" : "prepare item"}
      >
        ✎
      </button>
    </div>
  );
}

const ILLUSTRATE_EMPTY_ASSET = "illustrate-look-empty.png";

function IllustrationColumn({ illustrationUrl, fitTotal, onOpen }) {
  const formattedTotal = fitTotal == null ? "—" : `$${fitTotal.toFixed(2)}`;

  return (
    <div className="look-studio__illustration-column">
      <button
        type="button"
        className={`look-studio__illustration-frame${illustrationUrl ? "" : " look-studio__illustration-frame--empty"}`}
        onClick={onOpen}
        aria-label={illustrationUrl ? "View saved fashion illustration" : "Illustrate this outfit"}
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
          title="Based on saved prices for items currently in this outfit."
        >
          estimated outfit total
        </p>
        <p className="look-studio__fit-total-value">{formattedTotal}</p>
      </div>
    </div>
  );
}

function LookDetailView({
  look,
  onBack,
  collectionPieces,
  onSaveLayout,
  onPrepareCutout,
  onSaveIllustration,
}) {
  const { bedModelImageUrl, isUploading: isUploadingAvatar, uploadError: avatarUploadError, changeBedModelImage } =
    useBedModel();

  const [activeFilter, setActiveFilter] = useState("all");
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [preparingPiece, setPreparingPiece] = useState(null);
  const [isIllustrateModalOpen, setIsIllustrateModalOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  // Edit Mode / arrangement state. draftPositions/draftPlacedIds are the
  // ONLY things moving or placing a piece ever touch - Supabase doesn't
  // hear about any of it until "save look" succeeds.
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftPositions, setDraftPositions] = useState({});
  const [draftPlacedIds, setDraftPlacedIds] = useState(new Set());
  const [heldPieceId, setHeldPieceId] = useState(null);
  const [pieceZOrder, setPieceZOrder] = useState([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [saveLayoutError, setSaveLayoutError] = useState("");
  const [initialPositions, setInitialPositions] = useState({});
  const [initialPlacedIds, setInitialPlacedIds] = useState(new Set());
  // Live-hold math, deliberately non-reactive: written on pick-up, read on
  // every pointermove, cleared on drop.
  const holdStateRef = useRef(null);

  const catalogQuery = catalogSearchTerm.trim().toLowerCase();
  const catalogPieces = useMemo(
    () =>
      collectionPieces
        .filter((piece) => matchesFilter(piece, activeFilter))
        .filter((piece) => !catalogQuery || piece.name?.toLowerCase().includes(catalogQuery)),
    [collectionPieces, activeFilter, catalogQuery],
  );

  const lookPieceById = useMemo(() => {
    const map = new Map();
    look.wishitems.forEach((piece) => map.set(piece.id, piece));
    return map;
  }, [look.wishitems]);

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

  // Tracked globally so the held piece keeps following even if the pointer
  // outruns it or leaves the bed.
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
    // These only touch holdStateRef, so re-subscribing on every render would
    // buy nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldPieceId]);

  useEffect(() => {
    return () => {
      if (holdStateRef.current?.rafId != null) {
        cancelAnimationFrame(holdStateRef.current.rafId);
      }
    };
  }, []);

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
      commitHold();
      return;
    }

    setPieceZOrder((current) => [...current.filter((id) => id !== piece.id), piece.id]);

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

  function handleScaleChange(delta) {
    const held = holdStateRef.current;
    if (!held) return;

    held.scale = clamp(held.scale + delta, MIN_SCALE, MAX_SCALE);
    applyHoldFrame();
  }

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
      setCatalogNotice("your bed is full - remove an item first");
      return;
    }

    const nextPlacedIds = new Set(draftPlacedIds);
    nextPlacedIds.add(piece.id);

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
    // Fold an in-progress move into the payload rather than relying on the
    // async state setter having landed.
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

    // Removed pieces send only isPlaced:false - their old x/y/scale stay in
    // the database so they reappear where they were.
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
      setIsDiscardConfirmOpen(true);
      return;
    }

    onBack();
  }

  function handleConfirmDiscard() {
    setIsDiscardConfirmOpen(false);
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
          ←
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
            pieceZOrder={pieceZOrder}
            onPieceClick={handlePieceClick}
            onCanvasClick={handleCanvasClick}
            onKeyMove={handleKeyMove}
            bedModelImageUrl={bedModelImageUrl}
            isUploadingAvatar={isUploadingAvatar}
            avatarUploadError={avatarUploadError}
            onUploadAvatar={changeBedModelImage}
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
                  {isSavingLayout ? "saving..." : "Save outfit"}
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
                aria-label="Shrink selected item"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => handleScaleChange(SCALE_STEP)}
                aria-label="Enlarge selected item"
              >
                +
              </button>
              <span className="look-detail__resize-toolbar-hint">(− / + on your keyboard)</span>
            </div>
          )}

          {isEditMode && !heldPieceId && (
            <p className="look-studio__edit-hint">click an item on the bed to move it, or click one in your closet to add or remove it</p>
          )}

          {saveLayoutError && <p className="look-detail__panel-error look-detail__save-error">{saveLayoutError}</p>}
        </div>

        {/* The browseable catalog - every piece in the parent Collection,
            not just what's currently styled on the bed. */}
        <div className="look-detail__panel">
          <p className="look-studio__panel-label">Your closet</p>

          <div className="look-studio__filters" role="group" aria-label="Filter your items">
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
                <span className="look-studio__filter-icon">
                  <CategoryIcon filterKey={filter.key} />
                </span>
                <span className="look-studio__filter-label">{filter.label}</span>
              </button>
            ))}
          </div>

          {collectionPieces.length > 0 && (
            <label className="look-studio__search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                placeholder="Search items..."
                aria-label="Search items"
                value={catalogSearchTerm}
                onChange={(event) => setCatalogSearchTerm(event.target.value)}
              />
            </label>
          )}

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
              <p className="look-detail__panel-empty">
                {catalogQuery ? "no items found ♡" : "nothing here yet"}
              </p>
            )
          ) : (
            <p className="look-detail__panel-empty">no items in this collection yet</p>
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
                ✣ Style outfit
              </button>
            </div>
          )}
        </div>
      </div>

      {preparingPiece && (
        <Suspense fallback={null}>
          <PreparePieceModal
            product={preparingPiece}
            onClose={() => setPreparingPiece(null)}
            onSave={(blob) => onPrepareCutout(preparingPiece.id, blob)}
          />
        </Suspense>
      )}

      {isIllustrateModalOpen && (
        <IllustrateLookModal
          look={look}
          pieces={bedPieces}
          bedModelImageUrl={bedModelImageUrl}
          isUploadingAvatar={isUploadingAvatar}
          avatarUploadError={avatarUploadError}
          onUploadAvatar={changeBedModelImage}
          onClose={() => setIsIllustrateModalOpen(false)}
          onSaveIllustration={onSaveIllustration}
        />
      )}

      {isDiscardConfirmOpen && (
        <DiscardChangesModal
          onCancel={() => setIsDiscardConfirmOpen(false)}
          onConfirm={handleConfirmDiscard}
        />
      )}
    </div>
  );
}

export default LookDetailView;
