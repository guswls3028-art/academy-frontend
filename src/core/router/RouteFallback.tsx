import styles from "./RouteFallback.module.css";

type RouteFallbackProps = {
  fullPage?: boolean;
};

export default function RouteFallback({ fullPage = false }: RouteFallbackProps) {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className={fullPage ? `${styles.fallback} ${styles.fullPage}` : styles.fallback}
    >
      불러오는 중…
    </div>
  );
}
