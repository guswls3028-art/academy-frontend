import { useEffect, useState } from "react";
import ImageLightbox from "./ImageLightbox";
import styles from "./StaticReportPreview.module.css";

type StaticReportPreviewProps = {
  imageUrl: string;
  pdfUrl: string;
  alt: string;
  caption?: string;
  compact?: boolean;
  zoomable?: boolean;
};

export default function StaticReportPreview({
  imageUrl,
  pdfUrl,
  alt,
  caption,
  compact = false,
  zoomable = false,
}: StaticReportPreviewProps) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <figure
      data-testid="static-report-preview"
      className={`${styles.figure} ${compact ? styles.compact : ""}`}
    >
      {!compact && zoomable ? <div className={styles.mobileHint}>대표 화면을 누르면 크게 볼 수 있습니다</div> : null}
      <div className={styles.frame}>
        {failed ? (
          <div className={styles.failed}>
            <span>
              미리보기를 불러오지 못했습니다.
              <br />
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                전체 PDF 보기
              </a>
            </span>
          </div>
        ) : (
          zoomable ? (
            <button type="button" className={styles.zoomButton} onClick={() => setExpanded(true)} aria-label={`${alt} 크게 보기`}>
              <img
                src={imageUrl}
                alt={alt}
                width={1263}
                height={893}
                loading="eager"
                decoding="async"
                onError={() => setFailed(true)}
                className={styles.image}
              />
              <span>크게 보기</span>
            </button>
          ) : (
            <img
              src={imageUrl}
              alt={alt}
              width={1263}
              height={893}
              loading="eager"
              decoding="async"
              onError={() => setFailed(true)}
              className={styles.image}
            />
          )
        )}
      </div>
      {caption ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
      {expanded ? <ImageLightbox images={[imageUrl]} initialIndex={0} onClose={() => setExpanded(false)} /> : null}
    </figure>
  );
}
