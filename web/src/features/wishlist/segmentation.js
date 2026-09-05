import {
  SamModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";
// Interactive product-cutout segmentation - adapted from the proven
// standalone prototype at tools/interactive-cutout-test/app.js. Same
// model, same CDN-loading approach, same encode-once/decode-per-point
// architecture, just reshaped into reusable functions instead of a
// page-level script. No React and no Supabase in this file.
//
// Loaded from a CDN, not npm-installed: the actual inference runtime
// (onnxruntime-web, a transitive dependency of this package) is ~140MB
// unpacked on disk, mostly prebuilt WASM variants for browser features
// most users won't need - installing it as a normal dependency risks it
// silently ending up inside the app's own Vite/extension bundle unless
// extra bundler config is added. A runtime string-URL import is
// invisible to Vite's bundler, so nothing extra ships in the app; the
// ~14MB model is fetched once by the browser and cached there, and is
// never committed to this repo.
const MODEL_ID = "Xenova/slimsam-77-uniform";

const ONNX_RUNTIME_BASE_URL = new URL("onnx/", document.baseURI).href;

env.backends.onnx.wasm.wasmPaths = {
  mjs: `${ONNX_RUNTIME_BASE_URL}ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${ONNX_RUNTIME_BASE_URL}ort-wasm-simd-threaded.asyncify.wasm`,
};

let modelPromise = null;

// Module-level singleton - the model loads once for the whole page
// session and is reused by every Prepare Piece open after the first,
// regardless of how many times the modal is opened/closed.
export function loadSegmentationModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const model = await SamModel.from_pretrained(MODEL_ID, { dtype: "quantized" });
      const processor = await AutoProcessor.from_pretrained(MODEL_ID);
      return { model, processor };
    })();
  }

  return modelPromise;
}

// transformers.js's own image type, needed for the encoder/decoder
// calls - kept separate from the plain HTMLImageElement used for
// on-screen drawing and the final export.
export async function loadRawImage(url) {
  return RawImage.fromURL(url);
}

// Runs the expensive image encoder exactly once per source image.
export async function encodeImage(processor, model, rawImage) {
  const imageInputs = await processor(rawImage);
  const imageEmbeddings = await model.get_image_embeddings(imageInputs);
  return { imageInputs, imageEmbeddings };
}

// Re-decodes from scratch with the FULL current point list on every
// call, rather than incrementally patching the previous mask - simpler,
// and cheap because only the small decoder re-runs; imageEmbeddings
// (the expensive encoder output) is passed in unchanged and reused.
export async function decodePoints({ model, processor, rawImage, imageInputs, imageEmbeddings, points }) {
  const pointCoords = points.map((p) => [p.x, p.y]);
  const pointLabels = points.map((p) => p.label);

  const decoderInputs = await processor(rawImage, {
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
  const data = maskTensor.data.subarray(bestIndex * sliceSize, (bestIndex + 1) * sliceSize);

  return { width, height, data };
}

// Builds the final transparent PNG straight from the ORIGINAL image's
// own pixels - the mask only ever supplies the alpha channel, nothing
// is redrawn or recolored. Crops to the mask's bounding box with a
// small padding margin so the object doesn't touch the PNG's own edge.
export function buildCutoutBlob(imageEl, mask, { padding = 12 } = {}) {
  return new Promise((resolve, reject) => {
    const { width, height, data } = mask;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext("2d");
    sourceCtx.drawImage(imageEl, 0, 0, width, height);

    let sourceData;
    try {
      sourceData = sourceCtx.getImageData(0, 0, width, height);
    } catch {
      // Belt-and-suspenders: the explicit fetch-to-blob step in
      // PreparePieceModal should already catch a CORS-blocked image
      // before this ever runs, but a tainted canvas throws here too.
      reject(new Error("CANVAS_TAINTED"));
      return;
    }

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
      reject(new Error("NOTHING_SELECTED"));
      return;
    }

    sourceCtx.putImageData(sourceData, 0, 0);

    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(width, maxX + padding + 1) - cropX;
    const cropHeight = Math.min(height, maxY + padding + 1) - cropY;

    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = cropWidth;
    resultCanvas.height = cropHeight;
    resultCanvas
      .getContext("2d")
      .drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    resultCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("EXPORT_FAILED"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

// Brings a remote retailer image into the browser's own memory as a
// Blob before anything else touches it. This is the one explicit point
// where a CORS-disabled host fails, cleanly and predictably - once this
// succeeds, everything downstream (the display <img>, transformers.js's
// RawImage, and the export canvas) reads from that same local blob: URL
// instead of the original remote URL, so nothing further can taint a
// canvas or fail on cross-origin grounds.
export async function fetchImageAsBlob(url) {
  let response;

  try {
    response = await fetch(url, { mode: "cors" });
  } catch {
    throw new Error("IMAGE_FETCH_FAILED");
  }

  if (!response.ok) {
    throw new Error("IMAGE_FETCH_FAILED");
  }

  return response.blob();
}
