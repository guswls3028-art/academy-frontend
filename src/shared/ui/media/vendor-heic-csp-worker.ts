// Uses the unmodified LGPL decoder shipped by pinned heic-to@1.6.6.
// License/source: public/licenses/heic-to-1.6.6-{LICENSE,NOTICE}.txt.
// Owning the worker avoids uncancellable nested workers and full-size pixel
// copies onto the UI thread. Originals never leave the authorized browser.
import buildLibheif from "@homework-heic-decoder";
import { readBlobArrayBuffer } from "@/shared/utils/readBlobArrayBuffer";

const decoderModule = buildLibheif();
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<{ source: Blob; maxEdge: number }>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

async function decode(source: Blob): Promise<ImageData> {
  const decoder = new decoderModule.HeifDecoder();
  let images: ReturnType<typeof decoder.decode> = [];
  try {
    images = decoder.decode(await readBlobArrayBuffer(source));
    if (!images.length) throw new Error("No image");
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    if (width < 1 || height < 1 || width * height > 100_000_000) throw new Error("Image dimensions exceed preview memory budget");
    const pixels = new ImageData(width, height);
    for (let index = 3; index < pixels.data.length; index += 4) pixels.data[index] = 255;
    return await new Promise<ImageData>((resolve, reject) => {
      image.display(pixels, (result) => result ? resolve(result) : reject(new Error("Decode failed")));
    });
  } finally {
    for (const image of images) image.free();
    if (decoder.decoder) decoderModule.heif_context_free(decoder.decoder);
  }
}

// Older supported browsers lack OffscreenCanvas. Resize in the worker and
// transfer the small pixel buffer; never send the full camera image to the UI.
function resizePixels(source: ImageData, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  if (source.width === width && source.height === height) return source.data;
  const output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.max(0, (y + 0.5) * source.height / height - 0.5);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, source.height - 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = Math.max(0, (x + 0.5) * source.width / width - 0.5);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, source.width - 1);
      const fx = sx - x0;
      for (let channel = 0; channel < 4; channel++) {
        const top = source.data[(y0 * source.width + x0) * 4 + channel] * (1 - fx)
          + source.data[(y0 * source.width + x1) * 4 + channel] * fx;
        const bottom = source.data[(y1 * source.width + x0) * 4 + channel] * (1 - fx)
          + source.data[(y1 * source.width + x1) * 4 + channel] * fx;
        output[(y * width + x) * 4 + channel] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return output;
}

workerScope.onmessage = async ({ data }) => {
  try {
    const pixels = await decode(data.source);
    const ratio = Math.min(1, Math.max(320, Math.min(data.maxEdge, 2560)) / Math.max(pixels.width, pixels.height));
    const width = Math.max(1, Math.round(pixels.width * ratio));
    const height = Math.max(1, Math.round(pixels.height * ratio));
    if (typeof OffscreenCanvas !== "undefined" && typeof OffscreenCanvas.prototype.convertToBlob === "function" && typeof createImageBitmap === "function") {
      let bitmap: ImageBitmap | undefined;
      try {
        bitmap = await createImageBitmap(pixels, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
        workerScope.postMessage({ blob });
        return;
      } catch {
        // Some Safari versions expose these APIs without supporting every step.
        // The bounded pixel path below remains usable on those browsers.
      } finally {
        if (bitmap) bitmap.close();
      }
    }
    const output = resizePixels(pixels, width, height);
    workerScope.postMessage({ width, height, pixels: output.buffer }, [output.buffer]);
  } catch {
    workerScope.postMessage({ error: "decode" });
  }
};
