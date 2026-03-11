// PATH: src/features/homework/panels/HomeworkSubmissionsPanel.tsx
/**
 * 과제 제출관리 패널
 * - 학생별 제출 목록: 아바타 + 이름 + 강의칩 + 과+과제명 + 상태 + 파일 보기
 * - 주관식 과제 자동채점 TODO 버튼
 */

import { useQuery } from "@tanstack/react-query";
import { fetchHomeworkSubmissions } from "@/features/submissions/api/adminHomeworkSubmissionsApi";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/features/submissions/statusMaps";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function HomeworkSubmissionsPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  const hwQ = useAdminHomework(homeworkId);
  const homeworkTitle = hwQ.data?.title ?? "";

  const q = useQuery({
    queryKey: ["homework-submissions", homeworkId],
    queryFn: () => fetchHomeworkSubmissions(homeworkId),
    refetchInterval: 5000,
  });

  const handleViewFile = async (fileKey: string) => {
    try {
      const res = await api.post("/storage/inventory/presign/", { r2_key: fileKey });
      const url = res.data?.url;
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      feedback.error("파일을 열 수 없습니다.");
    }
  };

  if (q.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />;
  }

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      {/* 상단: 자동채점 버튼 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          제출관리 · <span className="text-[var(--color-text-muted)]">{rows.length}건</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => feedback.info("주관식 과제 자동채점 기능 준비 중입니다. (TODO)")}
          >
            주관식 과제 자동채점
          </Button>
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
            새로고침
          </Button>
        </div>
      </div>

      {q.isError && (
        <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
          제출 목록 조회 실패
        </div>
      )}

      {rows.length === 0 && !q.isError && (
        <EmptyState scope="panel" tone="empty" title="아직 제출된 과제가 없습니다." />
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)]">
          {rows.map((r) => {
            const tone = (SUBMISSION_STATUS_TONE as any)[r.status] ?? "neutral";
            const statusLabel = (SUBMISSION_STATUS_LABEL as any)[r.status] ?? r.status;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* 아바타 */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-bg-surface-soft)] flex items-center justify-center overflow-hidden"
                >
                  {r.profile_photo_url ? (
                    <img src={r.profile_photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[var(--color-text-muted)]">
                      {(r.student_name || "?").slice(0, 1)}
                    </span>
                  )}
                </div>

                {/* 이름 + 강의칩 */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium truncate">{r.student_name}</span>
                  {r.lecture_title && (
                    <LectureChip
                      lectureName={r.lecture_title}
                      color={r.lecture_color ?? undefined}
                      chipLabel={r.lecture_chip_label ?? undefined}
                      size={18}
                    />
                  )}
                </div>

                {/* 과+과제명 뱃지 */}
                <span
                  className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--color-bg-surface-soft)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  과 {homeworkTitle}
                </span>

                {/* 파일 정보 */}
                {r.file_type && (
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    {r.file_type} {formatFileSize(r.file_size)}
                  </span>
                )}

                <span className="flex-1" />

                {/* 상태 뱃지 */}
                <span className="ds-status-badge flex-shrink-0" data-tone={tone}>
                  {statusLabel}
                </span>

                {/* 제출 시각 */}
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                  {formatDate(r.created_at)}
                </span>

                {/* 파일 보기 버튼 */}
                {r.file_key && (
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => handleViewFile(r.file_key!)}
                  >
                    보기
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
