import { useEffect, useState } from "react";
import styles from "./CompactVideoThumbnail.module.css";

type Props = {
  thumbnailUrl?: string | null;
};

export default function CompactVideoThumbnail({ thumbnailUrl }: Props) {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageSrc = thumbnailUrl && !loadFailed ? thumbnailUrl : null;

  useEffect(() => {
    setLoadFailed(false);
  }, [thumbnailUrl]);

  return (
    <div
      className={styles.root}
      data-testid="video-thumbnail"
      aria-hidden="true"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className={styles.image}
          loading="lazy"
          decoding="async"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--tc-text-muted)"
          strokeWidth={1.5}
          aria-hidden
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )}
    </div>
  );
}
