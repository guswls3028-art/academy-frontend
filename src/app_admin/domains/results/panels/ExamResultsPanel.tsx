import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import AdminExamResultsTable from "../components/AdminExamResultsTable";
import { adminResultsQueryKeys } from "../queryKeys";
import StudentResultDrawer from "../components/StudentResultDrawer";
import ManualObjectiveAnswerEditor from "../components/ManualObjectiveAnswerEditor";
import OmrReviewWorkspace from "../components/omr-review/OmrReviewWorkspace";
import { AssessmentDisclosure } from "../components/AssessmentDisclosure";
import { fetchManualGradeSheet, type ManualGradeRow } from "../api/manualExamGrading";

import api from "@/shared/api/axios";
import { fetchAttendanceRoster } from "@/shared/api/contracts/attendance";
import { ATTENDANCE_META, ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";
import type { AdminExamResultRow } from "../types/results.types";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { useAdminExam } from "@admin/domains/exams/hooks/useAdminExam";
import { adminLectureQueryKeys } from "@admin/domains/lectures/queryKeys";

type Props = {
  examId: number;
  sessionId?: number;
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

export default function ExamResultsPanel({ examId, sessionId, lectureId = null, wrongCompletionOnly = false }: Props) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedOffline, setSelectedOffline] = useState<ManualGradeRow | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<number | null>(null);
  const [missingSearch, setMissingSearch] = useState("");
  const [missingOpen, setMissingOpen] = useState(false);

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
  const rows: AdminExamResultRow[] = data ?? [];
  const resultIds = new Set(rows.filter((row) => row.result_status !== "NOT_SUBMITTED").map((row) => row.enrollment_id));
  const missingRows = (manualSheet.data?.rows ?? []).filter((row) =>
    !resultIds.has(row.enrollment_id)
    && (lectureId == null || row.lectures.some((lecture) => lecture.id === lectureId)),
  );
  const attendance = useQuery({
    queryKey: [...adminLectureQueryKeys.attendanceForSession(sessionId), "exam-result-roster"],
    queryFn: () => sessionId ? fetchAttendanceRoster(sessionId) : [],
    enabled: Boolean(sessionId) && missingRows.length > 0 && !manualSheet.isError && missingOpen,
  });
  const attendanceByEnrollment = useMemo(() => {
    const statuses = new Map<number, AttendanceStatus>();
    for (const row of attendance.data ?? []) {
      const status = typeof row.status === "string" ? row.status.trim().toUpperCase() as AttendanceStatus : undefined;
      if (row.enrollment_id != null && status && ORDERED_ATTENDANCE_STATUS.includes(status)) {
        statuses.set(row.enrollment_id, status);
      }
    }
    return statuses;
  }, [attendance.data]);

  if (isLoading) {
    return <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />;
  }

  if (isError) {
    return <EmptyState scope="panel" tone="error" title="성적을 불러오지 못했습니다." />;
  }

  const filteredMissingRows = missingRows.filter((row) =>
    row.student_name.toLocaleLowerCase("ko-KR").includes(missingSearch.trim().toLocaleLowerCase("ko-KR")),
  );

  const selectedRow = rows.find((row) => row.enrollment_id === selectedEnrollmentId);
  const examTitle = exam?.title ?? "시험";

  return (
    <div className="space-y-4">
      {exam?.grading_mode === "choice" && (
        <AssessmentDisclosure
          title="답안 없는 시험 대상자"
          summary={manualSheet.isError ? "명단 확인 필요" : manualSheet.isLoading ? "확인 중…" : `${missingRows.length}명`}
          onToggle={setMissingOpen}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">스캔이 있다면 OMR 검토에서 먼저 확인해 주세요.</p>
            <Button type="button" intent="ghost" size="sm" onClick={() => void manualSheet.refetch()}>새로고침</Button>
          </div>
          {manualSheet.isError ? (
            <div className="mt-3" role="alert">
              <p className="text-sm">시험 대상자를 불러오지 못했습니다.</p>
              <Button type="button" intent="secondary" size="sm" onClick={() => void manualSheet.refetch()}>다시 시도</Button>
            </div>
          ) : manualSheet.isLoading ? (
            <p role="status" className="mt-2 text-sm">시험 대상자를 확인하는 중…</p>
          ) : missingRows.length > 0 ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span>현재 차시 출결과 시험 답안 상태를 함께 표시합니다.</span>
                {sessionId && attendance.isFetching && <span role="status">출결 확인 중…</span>}
                {sessionId && attendance.isError && (
                  <Button type="button" intent="secondary" size="sm" onClick={() => void attendance.refetch()}>출결 다시 불러오기</Button>
                )}
              </div>
              <input type="search" className="ds-input mt-3 w-full max-w-sm" value={missingSearch} onChange={(event) => setMissingSearch(event.target.value)} placeholder="답안 없는 학생 검색" aria-label="답안 없는 학생 검색" />
              {filteredMissingRows.length > 0 ? (
                <ul className="mt-3 divide-y divide-[var(--color-border-divider)]">
                  {filteredMissingRows.map((row) => {
                    const status = attendance.isSuccess ? attendanceByEnrollment.get(row.enrollment_id) : undefined;
                    const meta = status && ATTENDANCE_META[status];
                    return (
                      <li key={row.enrollment_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <strong className="break-words text-sm">{row.student_name}</strong>
                          <Badge tone={row.is_not_submitted ? "warning" : "neutral"} size="sm">
                            {row.is_not_submitted ? "결시 처리" : "답안 미등록"}
                          </Badge>
                          <Badge tone={meta?.tone ?? "neutral"} size="sm">
                            {meta ? `출결 ${meta.label}` : attendance.isSuccess ? "이 차시 출결 기록 없음" : "출결 미확인"}
                          </Badge>
                        </div>
                        <Button type="button" intent="secondary" size="sm" aria-haspopup="dialog" aria-label={`${row.student_name} · 답안 입력`} onClick={() => { setSelectedEnrollmentId(null); setSelectedOffline(row); }}>
                          답안 입력
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-3 text-sm text-[var(--color-text-muted)]">검색 결과가 없습니다.</p>}
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">현재 범위에는 답안 없는 대상자가 없습니다.</p>
          )}
        </AssessmentDisclosure>
      )}
      {rows.length === 0 && missingRows.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="아직 등록된 성적이 없습니다." />
      )}
      <div className="min-w-0" role="region" aria-label="시험 학생별 결과">
        <AdminExamResultsTable
          rows={rows}
          onSelectEnrollment={(id) => { setSelectedOffline(null); setSelectedEnrollmentId(id); }}
          wrongCompletionOnly={wrongCompletionOnly}
        />
      </div>

      {selectedOffline && manualSheet.data ? (
        <ManualObjectiveAnswerEditor
          key={selectedOffline.enrollment_id}
          examId={examId}
          row={selectedOffline}
          questions={manualSheet.data.questions}
          onClose={() => setSelectedOffline(null)}
          onSaved={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamResultsRoot(examId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamSummary(examId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.examQuestionStats(examId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.manualGradeSheet(examId) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.adminExamDetail(examId, selectedOffline.enrollment_id) }),
              queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.sessionScores }),
            ]);
            setSelectedOffline(null);
            setSelectedEnrollmentId(selectedOffline.enrollment_id);
          }}
        />
      ) : selectedRow && (
          <StudentResultDrawer
            examId={examId}
            enrollmentId={selectedRow.enrollment_id}
            studentName={selectedRow.student_name ?? "학생"}
            examTitle={examTitle}
            readOnly
            onReviewOmr={(submissionId) => { setSelectedEnrollmentId(null); setReviewSubmissionId(submissionId); }}
            onEditManualAnswers={() => {
              const candidate = manualSheet.data?.rows.find((row) => row.enrollment_id === selectedRow.enrollment_id);
              if (candidate) { setSelectedEnrollmentId(null); setSelectedOffline(candidate); }
            }}
            onClose={() => setSelectedEnrollmentId(null)}
          />
      )}
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
