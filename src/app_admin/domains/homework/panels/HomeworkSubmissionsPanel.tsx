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
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  formatSubmissionDate,
  formatSubmissionFileSize,
} from "@admin/domains/submissions/statusMaps";
import type { HomeworkSubmissionRow } from "@admin/domains/submissions/api/adminHomeworkSubmissions.api";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState, Badge, type BadgeTone } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import NotificationPreviewModal from "@/shared/ui/notifications/NotificationPreviewModal";
import api from "@/shared/api/axios";

function isMappedSubmissionStatus(status: string): status is keyof typeof SUBMISSION_STATUS_LABEL {
  return Object.prototype.hasOwnProperty.call(SUBMISSION_STATUS_LABEL, status);
}

function isNotSubmittedStatus(status: HomeworkSubmissionRow["status"]): boolean {
  return status === "not_submitted" || status === "NOT_SUBMITTED";
}

function getSubmissionStatusTone(status: HomeworkSubmissionRow["status"]): BadgeTone {
  if (isNotSubmittedStatus(status)) return "danger";
  return isMappedSubmissionStatus(status) ? SUBMISSION_STATUS_TONE[status] : "neutral";
}

function getSubmissionStatusLabel(status: HomeworkSubmissionRow["status"]): string {
  if (isNotSubmittedStatus(status)) return "미제출";
  return isMappedSubmissionStatus(status) ? SUBMISSION_STATUS_LABEL[status] : status;
}

function getNotSubmittedStudentId(row: HomeworkSubmissionRow): number | null {
  if (!isNotSubmittedStatus(row.status)) return null;
  const studentId = Number(row.student_id);
  return Number.isFinite(studentId) && studentId > 0 ? studentId : null;
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
    .map(getNotSubmittedStudentId)
    .filter((studentId): studentId is number => studentId != null);

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
            const tone = getSubmissionStatusTone(r.status);
            const statusLabel = getSubmissionStatusLabel(r.status);
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
                  clinicHighlight={r.name_highlight_clinic_target === true}
                />

                {/* 과+과제명 뱃지 */}
                <span
                  className="flex-shrink-0 rounded bg-[var(--color-bg-surface-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  과 {homeworkTitle}
                </span>

                {/* 파일 정보 */}
                {r.file_type && (
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    {r.file_type} {formatSubmissionFileSize(r.file_size)}
                  </span>
                )}

                <span className="flex-1" />

                {/* 상태 뱃지 */}
                <Badge variant="solid" tone={tone} className="flex-shrink-0">
                  {statusLabel}
                </Badge>

                {/* 제출 시각 */}
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                  {formatSubmissionDate(r.created_at)}
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
