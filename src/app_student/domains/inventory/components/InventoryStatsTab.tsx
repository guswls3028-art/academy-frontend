/**
 * 인벤토리 통계 탭 — 저장소 용량, 파일 타입 분포
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorageQuota } from "@/app_admin/domains/storage/api/storage.api";
import { StatCard, StatGrid } from "@student/shared/ui/components/StatCard";
import ProgressRing from "@student/shared/ui/components/ProgressRing";
import EmptyState from "@student/layout/EmptyState";
import type { InventoryFile, InventoryFolder } from "../api/inventory.api";
import styles from "./InventoryStatsTab.module.css";

type Props = {
  files: InventoryFile[];
  folders: InventoryFolder[];
};

type FileTypeGroup = {
  label: string;
  count: number;
  totalBytes: number;
  color: string;
};

const TYPE_MAP: { prefix: string; label: string; color: string }[] = [
  { prefix: "image/", label: "이미지", color: "var(--stu-success)" },
  { prefix: "video/", label: "영상", color: "var(--stu-primary)" },
  { prefix: "application/pdf", label: "PDF", color: "var(--stu-danger)" },
  { prefix: "application/", label: "문서", color: "var(--stu-warn)" },
];

function classifyType(contentType: string): string {
  for (const t of TYPE_MAP) {
    if (contentType.startsWith(t.prefix)) return t.label;
  }
  return "기타";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

export default function InventoryStatsTab({ files, folders }: Props) {
  const { data: quota } = useQuery({
    queryKey: ["storage-quota"],
    queryFn: fetchStorageQuota,
    staleTime: 60 * 1000,
  });

  const totalBytes = useMemo(() => files.reduce((s, f) => s + (f.sizeBytes || 0), 0), [files]);

  const typeGroups = useMemo((): FileTypeGroup[] => {
    const map = new Map<string, { count: number; totalBytes: number }>();
    for (const f of files) {
      const label = classifyType(f.contentType || "");
      const entry = map.get(label) ?? { count: 0, totalBytes: 0 };
      entry.count += 1;
      entry.totalBytes += f.sizeBytes || 0;
      map.set(label, entry);
    }
    const groups: FileTypeGroup[] = [];
    for (const t of TYPE_MAP) {
      const entry = map.get(t.label);
      if (entry) groups.push({ label: t.label, ...entry, color: t.color });
    }
    const etc = map.get("기타");
    if (etc) groups.push({ label: "기타", ...etc, color: "var(--stu-text-muted)" });
    return groups.sort((a, b) => b.totalBytes - a.totalBytes);
  }, [files]);

  if (files.length === 0 && folders.length === 0) {
    return <EmptyState title="저장소가 비어있습니다." description="파일을 업로드하면 통계가 표시됩니다." />;
  }

  const usagePercent = quota && quota.limitBytes > 0
    ? Math.round((quota.usedBytes / quota.limitBytes) * 100)
    : 0;
  const usageBarPercent = clampPercent(usagePercent);
  const usageColor = usagePercent >= 90 ? "var(--stu-danger)" : usagePercent >= 70 ? "var(--stu-warn)" : "var(--stu-primary)";

  return (
    <div className={styles.stack}>
      {/* 용량 요약 */}
      <div className={styles.summaryRow}>
        <ProgressRing
          percent={usagePercent}
          size={88}
          color={usageColor}
          sublabel="사용률"
        />
        <div className={styles.summaryStats}>
          <StatGrid>
            <StatCard label="파일 수" value={`${files.length}개`} />
            <StatCard label="폴더 수" value={`${folders.length}개`} />
            <StatCard label="총 용량" value={formatBytes(totalBytes)} />
          </StatGrid>
        </div>
      </div>

      {/* 용량 바 */}
      {quota && (
        <div>
          <div className={styles.quotaLabels}>
            <span className="stu-muted">{formatBytes(quota.usedBytes)} 사용</span>
            <span className="stu-muted">{formatBytes(quota.limitBytes)} 중</span>
          </div>
          <svg className={styles.quotaBar} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="8" fill="var(--stu-surface-soft)" rx="4" />
            <rect className={styles.barFill} width={usageBarPercent} height="8" fill={usageColor} rx="4" />
          </svg>
        </div>
      )}

      {/* 파일 타입별 분포 */}
      {typeGroups.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>
            파일 유형별 분포
          </div>
          <div className={styles.typeList}>
            {typeGroups.map((g) => (
              <div key={g.label} className={styles.typeRow}>
                <svg className={styles.typeMarker} viewBox="0 0 8 8" aria-hidden="true">
                  <circle cx="4" cy="4" r="4" fill={g.color} />
                </svg>
                <span className={styles.typeLabel}>{g.label}</span>
                <svg className={styles.typeBar} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                  <rect width="100" height="6" fill="var(--stu-surface-soft)" rx="3" />
                  <rect
                    className={styles.barFill}
                    width={totalBytes > 0 ? clampPercent((g.totalBytes / totalBytes) * 100) : 0}
                    height="6"
                    fill={g.color}
                    rx="3"
                  />
                </svg>
                <span className={`stu-muted ${styles.typeMeta}`}>
                  {g.count}개 · {formatBytes(g.totalBytes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
