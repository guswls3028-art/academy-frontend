/**
 * PATH: src/features/results/panels/ExamResultsPanel.tsx
 *
 * ✅ STEP 1 — Results 자동 진입 & 자동 선택 처리
 * ✅ 학생 클릭 시 우측 상세 오버레이(드로어)로 답안지/오답노트 표시
 *
 * 설계 계약:
 * - Session → Exam 진입 시 자동 선택은 Results 도메인 책임
 * - query param 기반 "최초 1회" 자동 선택
 * - 이후 상태 변경은 사용자 클릭만 반영
 * - OMR 검토 진입은 ExamResultsViewerPanel 상단 OmrReviewEntry가 담당
 *
 * ❌ 금지:
 * - session API 직접 호출
 * - enrollment 계산
 * - 전역 상태 / store 사용
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import AdminExamResultsTable from "../components/AdminExamResultsTable";
import { adminResultsQueryKeys } from "../queryKeys";
import StudentResultDrawer from "../components/StudentResultDrawer";
import ManualObjectiveAnswerEditor from "../components/ManualObjectiveAnswerEditor";
import OmrReviewWorkspace from "../components/omr-review/OmrReviewWorkspace";
import { fetchManualGradeSheet, type ManualGradeRow } from "../api/manualExamGrading";

import api from "@/shared/api/axios";
import type { AdminExamResultRow } from "../types/results.types";
import { Button, EmptyState } from "@/shared/ui/ds";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";

type Props = {
  examId: number;
  lectureId?: number | null;
  wrongCompletionOnly?: boolean;
};

async function fetchAdminExamResults(examId: number, lectureId?: number | null) {
  const res = await api.get(
    `/results/admin/exams/${examId}/results/`,
    { params: lectureId == null ? undefined : { lecture_id: lectureId } },
  );

  return Array.isArray(res.data?.results)
    ? res.data.results
    : Array.isArray(res.data)
    ? res.data
    : [];
}

export default function ExamResultsPanel({ examId, lectureId = null, wrongCompletionOnly = false }: Props) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedOffline, setSelectedOffline] = useState<ManualGradeRow | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<number | null>(null);
  const [missingSearch, setMissingSearch] = useState("");

  const initialEnrollmentId = Number(
    searchParams.get("enrollmentId")
  );

  const [selectedEnrollmentId, setSelectedEnrollmentId] =
    useState<number | null>(
      Number.isFinite(initialEnrollmentId) && initialEnrollmentId > 0
        ? initialEnrollmentId
        : null
    );

  const { data: exam } = useAdminExam(examId);
  const manualSheet = useQuery({
    queryKey: adminResultsQueryKeys.manualGradeSheet(examId),
    queryFn: () => fetchManualGradeSheet(examId),
    enabled: exam?.grading_mode === "choice",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: adminResultsQueryKeys.adminExamResults(examId, lectureId),
    queryFn: () => fetchAdminExamResults(examId, lectureId),
    enabled: Number.isFinite(examId),
  });

  if (isLoading || (exam?.grading_mode === "choice" && manualSheet.isLoading)) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError) {
    return <EmptyState scope="panel" tone="error" title="성적을 불러오지 못했습니다." />;
  }

  const rows: AdminExamResultRow[] = data ?? [];
  const resultIds = new Set(rows.filter((row) => row.result_status !== "NOT_SUBMITTED").map((row) => row.enrollment_id));
  const missingRows = (manualSheet.data?.rows ?? []).filter((row) =>
    !resultIds.has(row.enrollment_id)
    && (lectureId == null || row.lectures.some((lecture) => lecture.id === lectureId)),
  );
  const filteredMissingRows = missingRows.filter((row) =>
    row.student_name.toLocaleLowerCase("ko-KR").includes(missingSearch.trim().toLocaleLowerCase("ko-KR")),
  );

  const selectedRow = selectedEnrollmentId != null
    ? rows.find((r) => r.enrollment_id === selectedEnrollmentId) ?? null
    : null;
  const examTitle = exam?.title ?? "시험";

  return (
    <div className="space-y-4">
      {exam?.grading_mode === "choice" && (
        <section className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-4" aria-label="답안 없는 시험 대상자">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">답안 없는 시험 대상자 · {missingRows.length}명</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">OMR을 제출하지 않았거나 판독에 실패한 학생의 답안을 직접 입력할 수 있습니다. 스캔이 있다면 먼저 OMR 검토에서 확인해 주세요.</p>
            </div>
            <Button type="button" intent="ghost" size="sm" onClick={() => void manualSheet.refetch()}>새로고침</Button>
          </div>
          {manualSheet.isError ? (
            <div className="mt-3" role="alert">
              <p className="text-sm">시험 대상자를 불러오지 못했습니다.</p>
              <Button type="button" intent="secondary" size="sm" onClick={() => void manualSheet.refetch()}>다시 시도</Button>
            </div>
          ) : missingRows.length > 0 ? (
            <>
              <input type="search" className="ds-input mt-3 w-full max-w-sm" value={missingSearch} onChange={(event) => setMissingSearch(event.target.value)} placeholder="답안 없는 학생 검색" aria-label="답안 없는 학생 검색" />
              <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {filteredMissingRows.map((row) => (
                  <Button key={row.enrollment_id} type="button" intent="secondary" size="sm" onClick={() => { setSelectedEnrollmentId(null); setSelectedOffline(row); }}>
                    {row.student_name} · 답안 입력
                  </Button>
                ))}
                {filteredMissingRows.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">검색 결과가 없습니다.</p>}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">현재 범위에는 답안 없는 대상자가 없습니다.</p>
          )}
        </section>
      )}
      {rows.length === 0 && missingRows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="아직 등록된 성적이 없습니다." />
      )}
    <div
      className="flex min-h-[420px] min-w-0 flex-col gap-4 2xl:h-[calc(100vh-260px)] 2xl:flex-row"
      role="region"
      aria-label="시험 학생별 결과"
    >
      {/* ================= LEFT: 학생 리스트 ================= */}
      <div className="w-full min-w-0 shrink-0 overflow-auto border-b pb-3 2xl:w-[420px] 2xl:border-b-0 2xl:border-r 2xl:pb-0">
        <AdminExamResultsTable
          rows={rows}
          onSelectEnrollment={(id) => { setSelectedOffline(null); setSelectedEnrollmentId(id); }}
          wrongCompletionOnly={wrongCompletionOnly}
        />
      </div>

      {/* ================= RIGHT: 빈 안내 또는 드로어 오버레이 ================= */}
      {selectedOffline && manualSheet.data ? (
        <ManualObjectiveAnswerEditor
          key={selectedOffline.enrollment_id}
          examId={examId}
          row={selectedOffline}
          questions={manualSheet.data.questions}
          onClose={() => setSelectedOffline(null)}
          onSaved={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamResults(examId, lectureId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.manualGradeSheet(examId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamDetail(examId, selectedOffline.enrollment_id) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.sessionScores }),
            ]);
            setSelectedOffline(null);
            setSelectedEnrollmentId(selectedOffline.enrollment_id);
          }}
        />
      ) : selectedEnrollmentId == null ? (
        <div className="flex min-h-48 flex-1 items-center justify-center overflow-auto">
          <EmptyState
            scope="panel"
            tone="empty"
            mode="embedded"
            title="학생을 선택하세요"
            description="목록에서 학생을 클릭하면 우측에 답안지·오답노트 상세가 드로어로 열립니다."
          />
        </div>
      ) : (
        selectedRow && (
          <StudentResultDrawer
            examId={examId}
            enrollmentId={selectedEnrollmentId}
            studentName={selectedRow.student_name ?? "학생"}
            examTitle={examTitle}
            readOnly
            onReviewOmr={(submissionId) => { setSelectedEnrollmentId(null); setReviewSubmissionId(submissionId); }}
            onEditManualAnswers={() => {
              const candidate = manualSheet.data?.rows.find((row) => row.enrollment_id === selectedEnrollmentId);
              if (candidate) { setSelectedEnrollmentId(null); setSelectedOffline(candidate); }
            }}
            onClose={() => setSelectedEnrollmentId(null)}
          />
        )
      )}
    </div>
    <OmrReviewWorkspace
      examId={examId}
      examTitle={examTitle}
      initialSubmissionId={reviewSubmissionId ?? undefined}
      open={reviewSubmissionId != null}
      onClose={() => setReviewSubmissionId(null)}
    />
    </div>
  );
}
