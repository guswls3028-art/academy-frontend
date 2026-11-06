import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { prepareHomeworkHeicPreview } from "./homeworkHeicPreview";
import { isHeicPhoto } from "./photoType";
import styles from "./MediaPreview.module.css";

type Props = Pick<ComponentPropsWithoutRef<"img">, "style" | "onClick" | "loading"> & {
  src: string;
  filename: string;
  mimeType?: string | null;
  blob?: Blob;
  alt: string;
  className?: string;
  thumbnail?: boolean;
  onLoad?: () => void;
  onError: () => void;
};

function HeicPreview({ src, blob, className, thumbnail, onError, ...imageProps }: Omit<Props, "filename" | "mimeType">) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const errorHandler = useRef(onError);
  useEffect(() => { errorHandler.current = onError; }, [onError]);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void prepareHomeworkHeicPreview(blob ?? src, controller.signal, thumbnail ? 384 : 2560).then((converted) => {
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
  }, [src, blob, thumbnail]);

  if (!previewUrl) return <span className={styles.loading} role="status">사진 미리보기를 준비하는 중…</span>;
  return <img {...imageProps} src={previewUrl} decoding="async" className={`${styles.image} ${className ?? ""}`} onError={onError} />;
}

/** Render the original image or a temporary browser-compatible HEIC preview. */
export default function PhotoPreview({ src, filename, mimeType, blob, thumbnail, ...imageProps }: Props) {
  return isHeicPhoto(filename, mimeType)
    ? <HeicPreview key={src} src={src} blob={blob} thumbnail={thumbnail} {...imageProps} />
    : <img {...imageProps} src={src} decoding="async" />;
}
