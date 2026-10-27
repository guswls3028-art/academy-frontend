import { fetchPresignedMediaBlob } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import HomeworkHeicWorker from "./vendor-heic-csp-worker?worker";

const CONVERSION_TIMEOUT_MS = 30_000;
const CACHE_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, { blob: Blob; expires: number }>();
const localIds = new WeakMap<Blob, number>();
let nextLocalId = 0;
let cachedBytes = 0;
let cacheGeneration: string | null | undefined;
let conversionQueue: Promise<unknown> = Promise.resolve();
let worker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function cancelled(): DOMException {
  return new DOMException("Preview cancelled", "AbortError");
}

function stopWorker() {
  clearTimeout(idleTimer);
  worker?.terminate();
  worker = undefined;
}

function cacheIdentity(source: string | Blob, maxEdge: number): { key: string; expires: number } {
  let expires = Date.now() + 60_000;
  if (typeof source === "string") {
    // A cache hit never outlives the original capability or removes its query.
    try {
      const url = new URL(source);
      const date = url.searchParams.get("X-Amz-Date") ?? "";
      const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(date);
      const seconds = Number(url.searchParams.get("X-Amz-Expires"));
      if (!match || !Number.isFinite(seconds) || seconds <= 0) return { key: source, expires: 0 };
      expires = Math.min(expires, Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) + seconds * 1000);
    } catch { return { key: source, expires: 0 }; }
    return { key: `${maxEdge}:${source}`, expires };
  }
  if (!localIds.has(source)) localIds.set(source, ++nextLocalId);
  return { key: `${maxEdge}:local:${localIds.get(source)}`, expires };
}

function remember(key: string, blob: Blob, expires: number) {
  if (expires <= Date.now() || blob.size > CACHE_BYTES) return;
  const previous = cache.get(key);
  if (previous) { cachedBytes -= previous.blob.size; cache.delete(key); }
  cache.set(key, { blob, expires });
  cachedBytes += blob.size;
  while (cachedBytes > CACHE_BYTES || cache.size > 12) {
    const oldest = cache.keys().next().value;
    if (oldest == null) break;
    cachedBytes -= cache.get(oldest)!.blob.size;
    cache.delete(oldest);
  }
}

function encodePixels(data: { pixels: ArrayBuffer; width: number; height: number }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = canvas.height = 1;
      if (blob?.size) resolve(blob);
      else reject(new Error("Preview encoding failed"));
    }, "image/jpeg", 0.9);
  });
}

function convert(blob: Blob, maxEdge: number, signal: AbortSignal): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (signal.aborted) { reject(cancelled()); return; }
    clearTimeout(idleTimer);
    const activeWorker = worker ?? (worker = new HomeworkHeicWorker());
    let settled = false;
    const finish = (result: Blob | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      activeWorker.onmessage = activeWorker.onerror = activeWorker.onmessageerror = null;
      if (result instanceof Blob) { idleTimer = setTimeout(stopWorker, 10_000); resolve(result); }
      else { stopWorker(); reject(result); }
    };
    const abort = () => finish(cancelled());
    const timeout = setTimeout(() => finish(new Error("사진 미리보기 준비가 오래 걸립니다. 다시 시도해 주세요.")), CONVERSION_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    activeWorker.onerror = (event) => { event.preventDefault(); finish(new Error("사진을 읽지 못했습니다.")); };
    activeWorker.onmessageerror = () => finish(new Error("사진을 읽지 못했습니다."));
    activeWorker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string; pixels?: ArrayBuffer; width?: number; height?: number }>) => {
      const result = event.data;
      if (result.blob?.size) finish(result.blob);
      else if (result.pixels && result.width && result.height) {
        void encodePixels({ pixels: result.pixels, width: result.width, height: result.height }).then(finish, () => finish(new Error("사진을 읽지 못했습니다.")));
      } else finish(new Error("사진을 읽지 못했습니다."));
    };
    try { activeWorker.postMessage({ source: blob, maxEdge }); }
    catch { finish(new Error("사진을 읽지 못했습니다.")); }
  });
}

export function prepareHomeworkHeicPreview(source: string | Blob, signal: AbortSignal, maxEdge = 2560): Promise<Blob> {
  const generation = readAuthTokenEnvelopeSafely()?.generation ?? null;
  if (generation !== cacheGeneration) {
    cache.clear();
    cachedBytes = 0;
    cacheGeneration = generation;
  }
  const identity = cacheIdentity(source, maxEdge);
  const assertActive = () => {
    if (signal.aborted || (readAuthTokenEnvelopeSafely()?.generation ?? null) !== generation) throw cancelled();
  };
  const result = conversionQueue.catch(() => undefined).then(async () => {
    assertActive();
    const cached = cache.get(identity.key);
    if (cached && cached.expires > Date.now()) {
      cache.delete(identity.key);
      cache.set(identity.key, cached);
      return cached.blob;
    }
    const blob = typeof source === "string" ? await fetchPresignedMediaBlob(source, signal) : source;
    assertActive();
    const preview = await convert(blob, maxEdge, signal);
    assertActive();
    remember(identity.key, preview, identity.expires);
    return preview;
  });
  conversionQueue = result.catch(() => undefined);
  return result;
}
