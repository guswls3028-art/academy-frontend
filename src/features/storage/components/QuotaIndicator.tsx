// PATH: src/features/storage/components/QuotaIndicator.tsx
// 전체 테넌트 사용량 표시 (예: 4.2GB / 10GB)

import { useQuery } from "@tanstack/react-query";
import { fetchStorageQuota } from "../api/storage.api";
import styles from "./QuotaIndicator.module.css";

type QuotaIndicatorProps = {
  className?: string;
};

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)}KB`;
  return `${bytes}B`;
}

export default function QuotaIndicator({ className }: QuotaIndicatorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["storage-quota"],
    queryFn: fetchStorageQuota,
    staleTime: 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className={[styles.root, className].filter(Boolean).join(" ")}>
        <span className={styles.label}>사용량</span>
        <span className={styles.value}>—</span>
      </div>
    );
  }

  const { usedBytes, limitBytes, plan } = data;
  const pct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  const isLite = plan === "lite";
  const isOver = limitBytes > 0 && usedBytes >= limitBytes;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <span className={styles.label}>전체 테넌트 사용량</span>
      <span className={styles.value}>
        {formatBytes(usedBytes)} / {isLite ? "—" : formatBytes(limitBytes)}
      </span>
      {!isLite && limitBytes > 0 && (
        <div className={styles.bar}>
          <div
            className={[styles.barFill, isOver ? styles.barOver : ""].filter(Boolean).join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
