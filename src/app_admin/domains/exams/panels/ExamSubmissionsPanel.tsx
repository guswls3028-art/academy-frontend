// PATH: src/app_admin/domains/exams/panels/ExamSubmissionsPanel.tsx
/**
 * ExamSubmissionsPanel - 제출관리 통합
 * - OMR 제출 목록 확인
 * - 학생별 제출 목록: 아바타 + 이름 + 강의칩 + 시+시험명 + 상태 + 파일 보기
 * - 시험 자동채점 객관식 TODO 버튼
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchExamSubmissions } from "@admin/domains/submissions/api/adminSubmissions.api";
import { useAdminExam } from "../hooks/useAdminExam";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  formatSubmissionDate,
  formatSubmissionFileSize,
} from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState, Badge } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import styles from "./ExamSubmissionsPanel.module.css";

type Props = {
  examId: number;
  sessionId?: number | null;
};

export default function ExamSubmissionsPanel({ examId, sessionId: sessionIdProp }: Props) {
  const navigate = useNavigate();
  const { lectureId, sessionId: sessionIdFromPath } = useLectureSessionParams();
  const examQ = useAdminExam(examId);
  const examTitle = examQ.data?.title ?? "";
  const sessionId = sessionIdProp ?? sessionIdFromPath ?? null;
  const canOpenScores = Number.isFinite(lectureId) && Number(lectureId) > 0
    && Number.isFinite(sessionId) && Number(sessionId) > 0;

  const q = useQuery({
    queryKey: ["exam-submissions", examId],
    queryFn: () => fetchExamSubmissions(examId),
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

  const rows = q.data ?? [];
  const openScores = () => {
    if (!canOpenScores) {
      feedback.info("차시 성적 화면에서 OMR을 등록할 수 있습니다.");
      return;
    }
    navigate(`/admin/lectures/${lectureId}/sessions/${sessionId}/scores`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">OMR 제출 확인</div>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              스캔 등록은 차시 성적 화면의 상단 버튼에서 진행합니다.
            </p>
          </div>
          <Button type="button" intent="secondary" size="sm" onClick={openScores}>
            성적 탭 열기
          </Button>
        </div>
      </section>

      {/* 제출 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            제출관리 · <span className="text-[var(--color-text-muted)]">{rows.length}건</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" intent="ghost" size="sm" onClick={() => q.refetch()}>
              새로고침
            </Button>
          </div>
        </div>

        {q.isLoading && (
          <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />
        )}

        {q.isError && (
          <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
            제출 목록 조회 실패
          </div>
        )}

        {!q.isLoading && rows.length === 0 && !q.isError && (
          <EmptyState scope="panel" tone="empty" title="아직 제출된 시험이 없습니다." />
        )}

        {rows.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)]">
            {rows.map((r) => {
              const tone = SUBMISSION_STATUS_TONE[r.status];
              const statusLabel = SUBMISSION_STATUS_LABEL[r.status];
              const fileKey = r.file_key ?? "";
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* 아바타 + 이름 + 강의칩 (SSOT: StudentNameWithLectureChip) */}
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={32}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    chipSize={18}
                    clinicHighlight={r.name_highlight_clinic_target === true}
                  />

                  {/* 시+시험명 뱃지 */}
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${styles.examBadge}`}
                  >
                    시 {examTitle}
                  </span>

                  {/* 파일 정보 */}
                  {r.file_type && (
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      {r.file_type} {formatSubmissionFileSize(r.file_size)}
                    </span>
                  )}

                  {/* 점수 */}
                  {r.score != null && (
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] flex-shrink-0">
                      {r.score}점
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
                  {fileKey && (
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      onClick={() => handleViewFile(fileKey)}
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

      {/* 하단 안내 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          실패 · 지연은 정상 흐름입니다. 처리 중 오류가 발생해도 재업로드 · 재처리가 언제든 가능합니다.
        </p>
      </section>
    </div>
  );
}
