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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-8)" }}>
      {/* 용량 요약 */}
      <div style={{ display: "flex", gap: "var(--stu-space-6)", alignItems: "center" }}>
        <ProgressRing
          percent={usagePercent}
          size={88}
          color={usagePercent >= 90 ? "var(--stu-danger)" : usagePercent >= 70 ? "var(--stu-warn)" : "var(--stu-primary)"}
          sublabel="사용률"
        />
        <div style={{ flex: 1 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span className="stu-muted">{formatBytes(quota.usedBytes)} 사용</span>
            <span className="stu-muted">{formatBytes(quota.limitBytes)} 중</span>
          </div>
          <div style={{ borderRadius: "var(--stu-radius)", overflow: "hidden", height: 8, background: "var(--stu-surface-soft)" }}>
            <div style={{
              width: `${Math.min(usagePercent, 100)}%`,
              height: "100%",
              background: usagePercent >= 90 ? "var(--stu-danger)" : usagePercent >= 70 ? "var(--stu-warn)" : "var(--stu-primary)",
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

      {/* 파일 타입별 분포 */}
      {typeGroups.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: "var(--stu-space-4)" }}>
            파일 유형별 분포
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
            {typeGroups.map((g) => (
              <div key={g.label} style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-3)" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: g.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 50 }}>{g.label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--stu-surface-soft)", overflow: "hidden" }}>
                  <div style={{
                    width: totalBytes > 0 ? `${(g.totalBytes / totalBytes) * 100}%` : "0%",
                    height: "100%", background: g.color, borderRadius: 3, transition: "width 0.4s ease",
                  }} />
                </div>
                <span className="stu-muted" style={{ fontSize: 12, minWidth: 60, textAlign: "right" }}>
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
