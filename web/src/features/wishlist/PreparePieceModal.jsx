import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./PreparePieceModal.css";
import {
  buildCutoutBlob,
  decodePoints,
  encodeImage,
  fetchImageAsBlob,
  loadRawImage,
  loadSegmentationModel,
} from "./segmentation";
import { fetchProductImageViaProxy } from "./wishlist";

const ERROR_MESSAGES = {
  MODEL_LOAD_FAILED: "couldn't get things ready - check your connection and try again.",
  IMAGE_FETCH_FAILED: "this photo can't be prepared here - try a different photo for this item.",
  CANVAS_TAINTED: "this photo can't be prepared here - try a different photo for this item.",
  SEGMENT_FAILED: "couldn't update the selection - try clicking again.",
  NOTHING_SELECTED: "add at least one point first.",
  SAVE_FAILED: "couldn't save this piece - try again.",
};

// App only renders this while a piece is being prepared, so each open
// is a fresh mount - points/mask/etc. all start clean for free. The
// segmentation MODEL itself is a module-level singleton (see
// segmentation.js) and is NOT reloaded on each open.
function PreparePieceModal({ product, onClose, onSave }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [loadErrorKey, setLoadErrorKey] = useState(null);
  const [mode, setMode] = useState("include"); // "include" | "remove"
  const [points, setPoints] = useState([]);
  const [mask, setMask] = useState(null);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorKey, setSaveErrorKey] = useState(null);

  const canvasRef = useRef(null);
  const imageElRef = useRef(null);
  const objectUrlRef = useRef(null);
  const previewUrlRef = useRef(null);
  const sessionRef = useRef(null); // { model, processor, rawImage, imageInputs, imageEmbeddings }

  useEffect(() => {
    let isCurrent = true;

    async function setUp() {
      let blob;
      let objectUrl;

      try {
        const { model, processor } = await loadSegmentationModel();
        if (!isCurrent) return;

        // Direct fetch is the fast path (no extra hop) and works for
        // any CORS-friendly host (e.g. Shopify). Only falls back to the
        // proxy - which fixes it for any host, at the cost of one extra
        // network round trip - when that fails.
        try {
          blob = await fetchImageAsBlob(product.imageUrl);
        } catch {
          blob = await fetchProductImageViaProxy(product.imageUrl);
        }
        if (!isCurrent) return;

        objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        const imageEl = await loadHtmlImage(objectUrl);
        if (!isCurrent) return;
        imageElRef.current = imageEl;

        const canvas = canvasRef.current;
        canvas.width = imageEl.naturalWidth;
        canvas.height = imageEl.naturalHeight;
        drawCanvas(canvas, imageEl, null, []);

        const rawImage = await loadRawImage(objectUrl);
        if (!isCurrent) return;

        const { imageInputs, imageEmbeddings } = await encodeImage(processor, model, rawImage);
        if (!isCurrent) return;

        sessionRef.current = { model, processor, rawImage, imageInputs, imageEmbeddings };
        setPhase("ready");
      } catch (error) {
        if (!isCurrent) return;
        // Full detail goes to the console only - the on-screen message
        // stays plain-language, but this is what to check when the
        // generic message above doesn't say enough on its own.
        console.error("Prepare Piece setup failed:", error);
        setLoadErrorKey(error.message in ERROR_MESSAGES ? error.message : "MODEL_LOAD_FAILED");
        setPhase("error");
      }
    }

    setUp();

    return () => {
      isCurrent = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // product.imageUrl is fixed for the lifetime of this (fresh-mounted) modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    drawCanvas(canvasRef.current, imageElRef.current, mask, points);
  }, [phase, mask, points]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSaving]);

  async function runSegmentation(nextPoints) {
    setIsSegmenting(true);

    try {
      const session = sessionRef.current;
      const nextMask = await decodePoints({ ...session, points: nextPoints });
      setMask(nextMask);
    } catch (error) {
      console.error("Prepare Piece segmentation failed:", error);
      setLoadErrorKey("SEGMENT_FAILED");
    } finally {
      setIsSegmenting(false);
    }
  }

  function handleCanvasClick(event, label) {
    if (phase !== "ready" || isSegmenting) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const nextPoints = [
      ...points,
      {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
        label,
      },
    ];

    setPoints(nextPoints);
    runSegmentation(nextPoints);
  }

  function handleUndo() {
    const nextPoints = points.slice(0, -1);
    setPoints(nextPoints);

    if (nextPoints.length === 0) {
      setMask(null);
      return;
    }

    runSegmentation(nextPoints);
  }

  function handleClear() {
    setPoints([]);
    setMask(null);
    clearPreview();
  }

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }

  async function handlePreview() {
    if (!mask) return;

    try {
      const blob = await buildCutoutBlob(imageElRef.current, mask);
      clearPreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (error) {
      console.error("Prepare Piece preview failed:", error);
      setSaveErrorKey(error.message in ERROR_MESSAGES ? error.message : "SAVE_FAILED");
    }
  }

  async function handleSave() {
    if (!mask) {
      setSaveErrorKey("NOTHING_SELECTED");
      return;
    }

    setIsSaving(true);
    setSaveErrorKey(null);

    try {
      const blob = await buildCutoutBlob(imageElRef.current, mask);
      const result = await onSave(blob);

      if (result.success) {
        onClose();
      } else {
        setSaveErrorKey("SAVE_FAILED");
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Prepare Piece save failed:", error);
      setSaveErrorKey(error.message in ERROR_MESSAGES ? error.message : "SAVE_FAILED");
      setIsSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        className="modal prepare-piece-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prepare-piece-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="prepare-piece-title" className="modal__title">
          prepare this piece ♡
        </h2>

        <p className="modal__body">
          click the item you want to keep. add more points to refine the selection.
        </p>

        {phase === "loading" && (
          <div className="prepare-piece-modal__loading">
            <span className="prepare-piece-modal__spinner" aria-hidden="true" />
            <p className="prepare-piece-modal__status">getting your piece ready…</p>
          </div>
        )}

        {phase === "error" && (
          <p className="modal__error">{ERROR_MESSAGES[loadErrorKey]}</p>
        )}

        {phase === "ready" && (
          <div className="prepare-piece-modal__mode-toggle" role="group" aria-label="Point mode">
            <button
              type="button"
              className={`prepare-piece-modal__mode-btn${mode === "include" ? " is-active" : ""}`}
              aria-pressed={mode === "include"}
              onClick={() => setMode("include")}
            >
              + include
            </button>

            <button
              type="button"
              className={`prepare-piece-modal__mode-btn${mode === "remove" ? " is-active" : ""}`}
              aria-pressed={mode === "remove"}
              onClick={() => setMode("remove")}
            >
              − remove
            </button>
          </div>
        )}

        {/* Rendered unconditionally (just visually hidden) rather than only
            once phase === "ready" - setUp() needs canvasRef.current to
            already exist in the DOM while it's still loading/encoding, to
            draw the base image as soon as it's available. */}
        <div className="prepare-piece-modal__canvas-wrap" hidden={phase !== "ready"}>
          <canvas
            ref={canvasRef}
            className="prepare-piece-modal__canvas"
            onClick={(event) => handleCanvasClick(event, mode === "include" ? 1 : 0)}
            onContextMenu={(event) => {
              event.preventDefault();
              handleCanvasClick(event, 0);
            }}
          />

          {isSegmenting && <p className="prepare-piece-modal__segmenting">refining…</p>}
        </div>

        {phase === "ready" && (
          <>
            <div className="prepare-piece-modal__point-actions">
              <button type="button" onClick={handleUndo} disabled={points.length === 0 || isSegmenting}>
                undo
              </button>
              <button type="button" onClick={handleClear} disabled={points.length === 0 || isSegmenting}>
                clear
              </button>
              <button type="button" onClick={handlePreview} disabled={!mask || isSegmenting}>
                preview cutout
              </button>
            </div>

            {previewUrl && (
              <div className="prepare-piece-modal__preview">
                <img src={previewUrl} alt="cutout preview" />
              </div>
            )}

            {saveErrorKey && <p className="modal__error">{ERROR_MESSAGES[saveErrorKey]}</p>}
          </>
        )}

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onClose} disabled={isSaving}>
            cancel
          </button>

          {phase === "ready" && (
            <button
              type="button"
              className="modal__button modal__button--primary"
              onClick={handleSave}
              disabled={isSaving || !mask}
            >
              {isSaving ? "saving..." : "use this piece ♡"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_FETCH_FAILED"));
    img.src = url;
  });
}

function drawCanvas(canvas, imageEl, mask, points) {
  if (!canvas || !imageEl) return;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

  if (mask) {
    const overlay = ctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i++) {
      const isIncluded = mask.data[i] > 0;
      const offset = i * 4;
      overlay.data[offset] = 255;
      overlay.data[offset + 1] = 60;
      overlay.data[offset + 2] = 160;
      overlay.data[offset + 3] = isIncluded ? 110 : 0;
    }

    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = mask.width;
    overlayCanvas.height = mask.height;
    overlayCanvas.getContext("2d").putImageData(overlay, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);
  }

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = point.label === 1 ? "#3ddc84" : "#f2453d";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
}

export default PreparePieceModal;
