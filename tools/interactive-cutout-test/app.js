// Interactive SAM-style cutout prototype. Runs entirely in the browser -
// the model and its runtime (onnxruntime-web, via this import) are fetched
// from a CDN on first use and cached by the browser itself. No backend,
// no API key, no upload of your image anywhere: everything below runs on
// pixels already sitting in this tab's memory.
import { SamModel, AutoProcessor, RawImage } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

const MODEL_ID = "Xenova/slimsam-77-uniform";

const fileInput = document.getElementById("file-input");
const undoBtn = document.getElementById("undo-btn");
const clearBtn = document.getElementById("clear-btn");
const exportBtn = document.getElementById("export-btn");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("image-canvas");
const ctx = canvas.getContext("2d");
const previewWrap = document.getElementById("preview-wrap");
const previewCanvas = document.getElementById("preview-canvas");

let model = null;
let processor = null;

let currentImage = null; // transformers.js RawImage - fed to the processor/model
let currentImageEl = null; // plain HTMLImageElement - used for drawing/export
let imageEmbeddings = null; // encoder output for the CURRENT image only - reused across clicks
let imageInputs = null; // processor(image) output - carries original/reshaped sizes

// { x, y, label } in the image's own pixel coordinates (not screen
// coordinates - the canvas can be displayed smaller than the real image).
let points = [];
let currentMask = null; // { width, height, data } - data[i] > 0 means "included"

function setStatus(text) {
  statusEl.textContent = text;
}

setStatus("Loading model (first run downloads ~14MB, cached by the browser after)...");

model = await SamModel.from_pretrained(MODEL_ID, { dtype: "quantized" });
processor = await AutoProcessor.from_pretrained(MODEL_ID);

setStatus("Model ready. Choose an image.");
fileInput.disabled = false;

fileInput.addEventListener("change", handleFileSelected);
canvas.addEventListener("click", (event) => handleCanvasClick(event, 1));
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  handleCanvasClick(event, 0);
});
undoBtn.addEventListener("click", handleUndo);
clearBtn.addEventListener("click", handleClear);
exportBtn.addEventListener("click", handleExport);

async function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  resetSelection();
  setStatus("Loading image...");

  const url = URL.createObjectURL(file);
  currentImageEl = await loadHtmlImage(url);

  // 1:1 internal resolution - clicks are recorded in this same pixel
  // space, and CSS (max-width: 100%) handles the on-screen display size.
  canvas.width = currentImageEl.naturalWidth;
  canvas.height = currentImageEl.naturalHeight;
  drawBaseImage();

  currentImage = await RawImage.fromURL(url);

  setStatus("Encoding image (once)...");
  imageInputs = await processor(currentImage);
  imageEmbeddings = await model.get_image_embeddings(imageInputs);

  setStatus("Ready - left-click the product, right-click to exclude.");
  clearBtn.disabled = false;
}

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawBaseImage() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImageEl, 0, 0, canvas.width, canvas.height);
}

function drawPoints() {
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

// Painted as a translucent pink layer over the base image - purely a
// preview aid, never touches the actual exported pixels.
function drawMaskOverlay() {
  if (!currentMask) return;

  const { width, height, data } = currentMask;
  const overlay = ctx.createImageData(width, height);

  for (let i = 0; i < data.length; i++) {
    const isIncluded = data[i] > 0;
    const offset = i * 4;
    overlay.data[offset] = 255;
    overlay.data[offset + 1] = 60;
    overlay.data[offset + 2] = 160;
    overlay.data[offset + 3] = isIncluded ? 110 : 0;
  }

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  overlayCanvas.getContext("2d").putImageData(overlay, 0, 0);
  ctx.drawImage(overlayCanvas, 0, 0);
}

function redraw() {
  drawBaseImage();
  drawMaskOverlay();
  drawPoints();
}

async function handleCanvasClick(event, label) {
  if (!currentImage || !imageEmbeddings) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  points.push({
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    label,
  });

  undoBtn.disabled = false;
  await runSegmentation();
}

async function handleUndo() {
  points.pop();
  undoBtn.disabled = points.length === 0;

  if (points.length === 0) {
    currentMask = null;
    exportBtn.disabled = true;
    redraw();
    setStatus("Ready - left-click the product, right-click to exclude.");
    return;
  }

  await runSegmentation();
}

function handleClear() {
  resetSelection();
  redraw();
  setStatus("Ready - left-click the product, right-click to exclude.");
}

function resetSelection() {
  points = [];
  currentMask = null;
  undoBtn.disabled = true;
  exportBtn.disabled = true;
  previewWrap.hidden = true;
}

// Re-decodes from scratch with the FULL current point set every click,
// rather than trying to incrementally patch the previous mask - simpler,
// and cheap because only the small decoder re-runs; the image encoder
// (the expensive part) already ran once in handleFileSelected and its
// output (imageEmbeddings) is just reused here unchanged.
async function runSegmentation() {
  setStatus("Segmenting...");

  const pointCoords = points.map((p) => [p.x, p.y]);
  const pointLabels = points.map((p) => p.label);

  const decoderInputs = await processor(currentImage, {
    input_points: [[pointCoords]],
    input_labels: [[pointLabels]],
  });

  const outputs = await model({
    ...imageEmbeddings,
    input_points: decoderInputs.input_points,
    input_labels: decoderInputs.input_labels,
  });

  const masks = await processor.post_process_masks(
    outputs.pred_masks,
    imageInputs.original_sizes,
    imageInputs.reshaped_input_sizes,
  );

  // SAM proposes 3 candidate masks per prompt; pick the one the model
  // itself is most confident in (highest predicted IoU).
  const scores = outputs.iou_scores.data;
  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIndex]) bestIndex = i;
  }

  const maskTensor = masks[0]; // dims: [1, numCandidates, height, width]
  const [, , height, width] = maskTensor.dims;
  const sliceSize = height * width;
  const bestSlice = maskTensor.data.subarray(bestIndex * sliceSize, (bestIndex + 1) * sliceSize);

  currentMask = { width, height, data: bestSlice };
  exportBtn.disabled = false;

  redraw();
  setStatus("Ready - add more points to refine, or export.");
}

// Builds the final PNG straight from the ORIGINAL image's own pixels -
// the mask only ever supplies the alpha channel. Nothing here generates
// or alters color data.
function handleExport() {
  if (!currentMask || !currentImageEl) return;

  const { width, height, data } = currentMask;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceCtx = sourceCanvas.getContext("2d");
  sourceCtx.drawImage(currentImageEl, 0, 0, width, height);
  const sourceData = sourceCtx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isIncluded = data[i] > 0;
      sourceData.data[i * 4 + 3] = isIncluded ? 255 : 0;

      if (isIncluded) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    setStatus("Nothing selected yet - add at least one point first.");
    return;
  }

  sourceCtx.putImageData(sourceData, 0, 0);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = cropWidth;
  resultCanvas.height = cropHeight;
  resultCanvas
    .getContext("2d")
    .drawImage(sourceCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  previewCanvas.width = cropWidth;
  previewCanvas.height = cropHeight;
  previewCanvas.getContext("2d").drawImage(resultCanvas, 0, 0);
  previewWrap.hidden = false;

  resultCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cutout.png";
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
