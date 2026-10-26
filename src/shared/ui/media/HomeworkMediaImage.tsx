import { useEffect, useRef, useState } from "react";
import styles from "./HomeworkMediaImage.module.css";

type Props = {
  src: string;
  filename: string;
  mimeType?: string;
  blob?: Blob;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError: () => void;
};

// Several selected phone photos can mount together. Decode one at a time so
// full-resolution pixel buffers do not multiply on mobile devices.
let conversionQueue: Promise<unknown> = Promise.resolve();

function assertActive(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Image preview cancelled");
}

function convertPreview(source: string | Blob, signal: AbortSignal): Promise<Blob> {
  const result = conversionQueue.catch(() => undefined).then(async () => {
    assertActive(signal);
    let blob: Blob;
    if (typeof source === "string") {
      const response = await fetch(source, { signal, credentials: "omit" });
      if (!response.ok) throw new Error("Image preview download failed");
      blob = await response.blob();
    } else {
      blob = source;
    }
    assertActive(signal);
    const { default: heic2any } = await import("heic2any");
    assertActive(signal);
    const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.9 });
    assertActive(signal);
    const image = Array.isArray(converted) ? converted[0] : converted;
    if (!image?.size) throw new Error("Image preview conversion failed");
    return image;
  });
  conversionQueue = result.catch(() => undefined);
  return result;
}

function HeicPreview({ src, blob, alt, className, onLoad, onError }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const errorHandler = useRef(onError);
  useEffect(() => { errorHandler.current = onError; }, [onError]);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void convertPreview(blob ?? src, controller.signal).then((converted) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(converted);
      setPreviewUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) errorHandler.current();
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, blob]);

  if (!previewUrl) return <span className={styles.loading} role="status">사진 미리보기를 준비하는 중…</span>;
  return <img src={previewUrl} alt={alt} className={`${styles.image} ${className ?? ""}`} onLoad={onLoad} onError={onError} />;
}

/** Display the original authorized file without replacing the stored submission. */
export default function HomeworkMediaImage(props: Props) {
  const { src, filename, mimeType, alt, className, onLoad, onError } = props;
  const isHeic = /^image\/hei[cf](?:-sequence)?(?:;|$)/i.test(mimeType ?? "") || /\.hei[cf]$/i.test(filename);
  return isHeic
    ? <HeicPreview key={src} {...props} />
    : <img src={src} alt={alt} className={className} onLoad={onLoad} onError={onError} />;
}
