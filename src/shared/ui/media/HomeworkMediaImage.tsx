import { useEffect, useRef, useState } from "react";
import { prepareHomeworkHeicPreview } from "./homeworkHeicPreview";
import styles from "./HomeworkMediaImage.module.css";

type Props = {
  src: string;
  filename: string;
  mimeType?: string;
  blob?: Blob;
  alt: string;
  className?: string;
  thumbnail?: boolean;
  onLoad?: () => void;
  onError: () => void;
};

function HeicPreview({ src, blob, alt, className, thumbnail, onLoad, onError }: Props) {
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
  return <img src={previewUrl} alt={alt} decoding="async" className={`${styles.image} ${className ?? ""}`} onLoad={onLoad} onError={onError} />;
}

/** Display the original authorized file without replacing the stored submission. */
export default function HomeworkMediaImage(props: Props) {
  const { src, filename, mimeType, alt, className, onLoad, onError } = props;
  const isHeic = /^image\/hei[cf](?:-sequence)?(?:;|$)/i.test(mimeType ?? "") || /\.hei[cf]$/i.test(filename);
  return isHeic
    ? <HeicPreview key={src} {...props} />
    : <img src={src} alt={alt} decoding="async" className={className} onLoad={onLoad} onError={onError} />;
}
