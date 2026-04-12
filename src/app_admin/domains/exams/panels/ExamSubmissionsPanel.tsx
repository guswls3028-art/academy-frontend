// PATH: src/app_admin/domains/exams/panels/ExamSubmissionsPanel.tsx
/**
 * ExamSubmissionsPanel - 제출관리 통합
 * - OMR 업로드 작업대 (기존)
 * - 학생별 제출 목록: 아바타 + 이름 + 강의칩 + 시+시험명 + 상태 + 파일 보기
 * - 시험 자동채점 객관식 TODO 버튼
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminOmrUploadSection from "@admin/domains/submissions/components/AdminOmrUploadSection";
import { fetchExamSubmissions } from "@admin/domains/submissions/api/adminSubmissions.api";
import { useAdminExam } from "../hooks/useAdminExam";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
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

type Props = {
  examId: number;
};

export default function ExamSubmissionsPanel({ examId }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  const examQ = useAdminExam(examId);
  const examTitle = examQ.data?.title ?? "";

  const q = useQuery({
    queryKey: ["exam-submissions", examId, refreshKey],
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

  return (
    <div className="space-y-6">
      {/* OMR 업로드 섹션 — 통합 카드 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
        <div className="border-b border-[var(--color-border-divider)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">OMR 시험 운영</div>
          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            스캔 파일만 업로드하면 학생 식별(8자리)은 OMR 마킹값으로 자동 처리됩니다.
          </div>
        </div>
        <div className="p-4">
          <AdminOmrUploadSection
            examId={examId}
            onUploaded={() => setRefreshKey((k) => k + 1)}
          />
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
              const tone = (SUBMISSION_STATUS_TONE as any)[r.status] ?? "neutral";
              const statusLabel = (SUBMISSION_STATUS_LABEL as any)[r.status] ?? r.status;
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
                    clinicHighlight={(r as any).name_highlight_clinic_target === true}
                  />

                  {/* 시+시험명 뱃지 */}
                  <span
                    className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--color-bg-surface-soft)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    시 {examTitle}
                  </span>

                  {/* 파일 정보 */}
                  {r.file_type && (
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      {r.file_type} {formatFileSize(r.file_size)}
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

      {/* 하단 안내 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          실패 · 지연은 정상 흐름입니다. 처리 중 오류가 발생해도 재업로드 · 재처리가 언제든 가능합니다.
        </p>
      </section>
    </div>
  );
}
