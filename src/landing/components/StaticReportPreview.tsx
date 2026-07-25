import { useEffect, useState } from "react";
import styles from "./StaticReportPreview.module.css";

type StaticReportPreviewProps = {
  imageUrl: string;
  pdfUrl: string;
  alt: string;
  caption?: string;
  compact?: boolean;
};

export default function StaticReportPreview({
  imageUrl,
  pdfUrl,
  alt,
  caption,
  compact = false,
}: StaticReportPreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <figure
      data-testid="static-report-preview"
      className={`${styles.figure} ${compact ? styles.compact : ""}`}
    >
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
        )}
      </div>
      {caption ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
