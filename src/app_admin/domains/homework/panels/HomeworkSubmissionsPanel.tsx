// PATH: src/app_admin/domains/homework/panels/HomeworkSubmissionsPanel.tsx
/**
 * 과제 제출관리 패널
 * - 학생별 제출 목록: 아바타 + 이름 + 강의칩 + 과+과제명 + 상태 + 파일 보기
 * - 주관식 과제 자동채점 TODO 버튼
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHomeworkSubmissions } from "@admin/domains/submissions/api/adminHomeworkSubmissions.api";
import { useAdminHomework } from "../hooks/useAdminHomework";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import NotificationPreviewModal from "@admin/domains/messages/components/NotificationPreviewModal";
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
  const [notSubmittedNotif, setNotSubmittedNotif] = useState(false);

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

  // 미제출 학생 ID 추출 (status가 "not_submitted" 또는 제출 기록 없는 학생)
  const notSubmittedIds = rows
    .filter((r: any) => r.status === "not_submitted" || r.status === "NOT_SUBMITTED")
    .map((r: any) => r.student_id)
    .filter(Boolean) as number[];

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          제출관리 · <span className="text-[var(--color-text-muted)]">{rows.length}건</span>
          {notSubmittedIds.length > 0 && (
            <span className="ml-2 text-[var(--color-text-muted)]">(미제출 {notSubmittedIds.length}명)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notSubmittedIds.length > 0 && (
            <Button type="button" intent="ghost" size="sm" onClick={() => setNotSubmittedNotif(true)}>
              미제출 알림 발송
            </Button>
          )}
          <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
            새로고침
          </Button>
        </div>
      </div>

      {/* 미제출 알림 모달 */}
      <NotificationPreviewModal
        open={notSubmittedNotif}
        onClose={() => setNotSubmittedNotif(false)}
        mode="manual"
        trigger="assignment_not_submitted"
        studentIds={notSubmittedIds}
        label="과제 미제출 알림"
        sendTo="parent"
        context={{ 과제명: homeworkTitle }}
      />

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
                {/* 아바타 + 이름 + 강의칩 (SSOT) */}
                <StudentNameWithLectureChip
                  name={r.student_name}
                  lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                  profilePhotoUrl={r.profile_photo_url}
                  avatarSize={32}
                  chipSize={18}
                  clinicHighlight={(r as any).name_highlight_clinic_target === true}
                />

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
