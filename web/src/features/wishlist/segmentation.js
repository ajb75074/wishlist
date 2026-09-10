import {
  SamModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

// SlimSAM (Xenova/slimsam-77-uniform) run in-browser via transformers.js on
// ONNX Runtime WASM.
const MODEL_ID = "Xenova/slimsam-77-uniform";

const ONNX_RUNTIME_BASE_URL = new URL("onnx/", document.baseURI).href;

env.backends.onnx.wasm.wasmPaths = {
  mjs: `${ONNX_RUNTIME_BASE_URL}ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${ONNX_RUNTIME_BASE_URL}ort-wasm-simd-threaded.asyncify.wasm`,
};

let modelPromise = null;

// Singleton - loads once per page session, reused across every
// Prepare Piece open.
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

export async function loadRawImage(url) {
  return RawImage.fromURL(url);
}

export async function encodeImage(processor, model, rawImage) {
  const imageInputs = await processor(rawImage);
  const imageEmbeddings = await model.get_image_embeddings(imageInputs);
  return { imageInputs, imageEmbeddings };
}

// Re-decodes from the full current point list on every call rather
// than patching the previous mask - only the cheap decoder re-runs;
// imageEmbeddings (the expensive part) is reused unchanged.
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

  // SAM proposes 3 candidate masks per prompt; keep the one with the
  // highest predicted IoU.
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

// Builds a transparent PNG from the original pixels - the mask only
// supplies alpha, nothing is redrawn or recolored. Crops to the mask's
// bounding box plus a small padding margin.
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

// Fetched into a local blob: URL before anything else touches the
// image, so a CORS-disabled retailer host fails once, here, instead of
// silently tainting the canvas later.
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
