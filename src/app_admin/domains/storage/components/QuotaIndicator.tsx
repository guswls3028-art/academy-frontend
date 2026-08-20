// PATH: src/app_admin/domains/storage/components/QuotaIndicator.tsx
// 전체 테넌트 사용량 표시 (예: 4.2GB / 10GB)

import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { fetchStorageQuota } from "../api/storage.api";
import { storageQueryKeys } from "../queryKeys";
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: storageQueryKeys.storageQuota,
    queryFn: fetchStorageQuota,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={[styles.root, className].filter(Boolean).join(" ")}>
        <span className={styles.label}>사용량</span>
        <span className={styles.value}>—</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <button type="button" className={[styles.root, className].filter(Boolean).join(" ")} onClick={() => void refetch()} title="저장소 사용량 다시 조회">
        <span className={styles.label}>사용량 조회 실패</span>
        <span className={styles.value}>다시 시도</span>
      </button>
    );
  }

  const { usedBytes, limitBytes } = data;
  const pct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  const isOver = limitBytes > 0 && usedBytes >= limitBytes;
  const barFillStyle = { "--quota-fill-width": `${pct}%` } as CSSProperties;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <span className={styles.label}>전체 테넌트 사용량</span>
      <span className={styles.value}>
        {formatBytes(usedBytes)} / {formatBytes(limitBytes)}
      </span>
      {limitBytes > 0 && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="저장공간 사용률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={[styles.barFill, isOver ? styles.barOver : ""].filter(Boolean).join(" ")}
            style={barFillStyle}
          />
        </div>
      )}
    </div>
  );
}
