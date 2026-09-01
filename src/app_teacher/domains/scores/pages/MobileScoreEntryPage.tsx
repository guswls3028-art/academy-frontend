// PATH: src/app_teacher/domains/scores/pages/MobileScoreEntryPage.tsx
// 성적 입력 — 모바일 최적화. 숫자 키패드 + 자동 다음 포커스 + 만점/평균 KPI + 즉시 검증
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { cx } from "@/shared/utils/cx";
import { extractApiError } from "@/shared/utils/extractApiError";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import {
  fetchSessionExams,
  fetchExamResults,
  updateResult,
  type TeacherExamResultRow,
} from "../api";
import {
  fetchSessionEnrollments,
  type SessionEnrollmentRow as SessionEnrollment,
} from "@/shared/api/contracts/sessionEnrollments";
import {
  fetchSessionScores,
  patchAssessmentCorrection,
  type ScoreBlock,
  type SessionScoresResponse,
} from "@/shared/api/contracts/sessionScores";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import {
  getExamResultEnrollmentId,
  getExamResultMaxScore,
  getExamResultScore,
  invalidateTeacherExamResultQueries,
} from "@teacher/domains/results/examResultContract";
import { teacherScoresQueryKeys } from "../queryKeys";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useWrongCompletionDisplay } from "@/shared/scoring/assessmentStatusDisplay";
import styles from "./MobileScoreEntryPage.module.css";

type Tone = "success" | "warning" | "danger" | "muted";
type ReviewFilter = "all" | "pending" | "resolved" | "waiting";
type CorrectionStatus = ScoreBlock["correction_status"];

function correctionBucket(status: CorrectionStatus): ReviewFilter {
  if (status === "PENDING") return "pending";
  if (status === "COMPLETED" || status === "NOT_REQUIRED") return "resolved";
  return "waiting";
}

function scoreTone(value: number | null, maxScore: number): Tone | undefined {
  if (value == null) return undefined;
  if (value >= maxScore * 0.7) return "success";
  if (value >= maxScore * 0.4) return "warning";
  return undefined;
}

function rateTone(value: number | null): Tone | undefined {
  if (value == null) return undefined;
  if (value >= 70) return "success";
  if (value >= 40) return "warning";
  return "danger";
}

export default function MobileScoreEntryPage() {
  const { user } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sid = Number(sessionId);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: teacherScoresQueryKeys.sessionExams(sid),
    queryFn: () => fetchSessionExams(sid),
    enabled: Number.isFinite(sid),
  });

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: teacherScoresQueryKeys.sessionEnrollments(sid),
    queryFn: () => fetchSessionEnrollments(sid),
    enabled: Number.isFinite(sid),
  });

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const requestedExamId = Number(searchParams.get("exam"));
  const routedExamId = Number.isFinite(requestedExamId)
    && exams?.some((exam) => exam.id === requestedExamId)
    ? requestedExamId
    : null;
  const activeExamId = selectedExamId ?? routedExamId ?? exams?.[0]?.id ?? null;
  const activeExam = exams?.find((e) => e.id === activeExamId);
  const tenantCode = getTenantCodeForApiRequest();
  const draftScope = tenantCode && user?.id
    ? `${tenantCode}:${user.id}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={cx("text-[17px] font-bold", styles.title)}>
          성적 입력
        </h1>
      </div>

      {examsLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : exams && exams.length > 0 ? (
        <>
          {/* Exam selector chips — 만점 라벨로 컨텍스트 부여 */}
          <div className={cx("flex gap-2 overflow-x-auto pb-1", styles.examTabs)}>
            {exams.map((exam) => {
              const active = exam.id === activeExamId;
              return (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={cx(
                    "rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer",
                    active ? styles.examTabActive : styles.examTab,
                  )}
                >
                  {exam.title}{exam.max_score != null ? ` · ${exam.max_score}점` : ""}
                </button>
              );
            })}
          </div>
          {activeExamId && (
            <ScoreEntryList
              sessionId={sid}
              examId={activeExamId}
              examMaxScore={activeExam?.max_score ?? 100}
              examPassScore={activeExam?.pass_score ?? null}
              enrollments={enrollments ?? []}
              rosterLoading={enrollmentsLoading}
              draftScope={draftScope}
            />
          )}
        </>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title="이 차시에 연결된 시험이 없습니다"
          description="강의 차시에 시험을 추가하면 모바일에서 바로 점수를 입력할 수 있습니다."
          actions={
            <EmptyActionButton variant="secondary" onClick={() => navigate(-1)}>
              차시로 돌아가기
            </EmptyActionButton>
          }
        />
      )}
    </div>
  );
}

/** sessionStorage 보호: refetch/invalidate 후에도 미저장 입력값 유지. 탭 닫으면 제거. */
const draftKeyForExam = (scope: string, examId: number) =>
  `academy:score-entry-draft:v2:${scope}:${examId}`;

function loadDraft(scope: string | null, examId: number): Map<number, string> {
  if (!scope) return new Map();
  try {
    const raw = sessionStorage.getItem(draftKeyForExam(scope, examId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
}
function saveDraft(scope: string | null, examId: number, m: Map<number, string>) {
  if (!scope) return;
  try {
    if (m.size === 0) {
      sessionStorage.removeItem(draftKeyForExam(scope, examId));
      return;
    }
    const obj: Record<string, string> = {};
    m.forEach((v, k) => { obj[String(k)] = v; });
    sessionStorage.setItem(draftKeyForExam(scope, examId), JSON.stringify(obj));
  } catch { /* quota exceeded — non-critical */ }
}

function ScoreEntryList({
  sessionId,
  examId,
  examMaxScore,
  examPassScore,
  enrollments,
  rosterLoading,
  draftScope,
}: {
  sessionId: number;
  examId: number;
  examMaxScore: number;
  examPassScore: number | null;
  enrollments: SessionEnrollment[];
  rosterLoading: boolean;
  draftScope: string | null;
}) {
  const qc = useQueryClient();
  const wrongCompletionOnly = useWrongCompletionDisplay();
  const { data: rawResults, isLoading: resultsLoading } = useQuery({
    queryKey: teacherScoresQueryKeys.examResults(examId),
    queryFn: () => fetchExamResults(examId),
    enabled: Number.isFinite(examId),
  });
  const { data: scoreSheet, isLoading: scoreSheetLoading } = useQuery({
    queryKey: scoresQueryKeys.sessionScores(sessionId),
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  // result row + enrollment 매핑 — 점수 매겨진 학생은 result, 아닌 학생은 enrollment 기반 가상 row
  const results = useMemo(() => {
    const byEnrollment = new Map<number, TeacherExamResultRow>();
    for (const r of rawResults ?? []) {
      const enrollmentId = getExamResultEnrollmentId(r);
      if (enrollmentId != null) byEnrollment.set(enrollmentId, r);
    }
    const active = (enrollments ?? []).filter((e) => Number.isFinite(e.enrollment) && e.enrollment > 0);
    if (active.length === 0) return rawResults ?? [];
    return active.map((e): TeacherExamResultRow => {
      const fromResult = byEnrollment.get(e.enrollment);
      if (fromResult) return fromResult;
      return {
        enrollment_id: e.enrollment,
        student_name: e.student_name || "이름 없음",
        exam_score: null,
        final_score: null,
        total_score: null,
        exam_max_score: examMaxScore,
        max_score: examMaxScore,
        passed: null,
        final_pass: null,
        achievement: null,
      };
    });
  }, [rawResults, enrollments, examMaxScore]);
  const allowedEnrollmentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const e of enrollments ?? []) {
      if (Number.isFinite(e.enrollment) && e.enrollment > 0) ids.add(e.enrollment);
    }
    if (ids.size === 0) {
      for (const r of rawResults ?? []) {
        const enrollmentId = getExamResultEnrollmentId(r);
        if (enrollmentId != null) ids.add(enrollmentId);
      }
    }
    return ids;
  }, [enrollments, rawResults]);
  const correctionByEnrollment = useMemo(() => {
    const map = new Map<number, ScoreBlock>();
    for (const row of scoreSheet?.rows ?? []) {
      const entry = row.exams.find((exam) => exam.exam_id === examId);
      if (entry) map.set(row.enrollment_id, entry.block);
    }
    return map;
  }, [examId, scoreSheet?.rows]);

  // row 식별자 = enrollment_id (admin endpoint schema SSOT)
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const pendingSubmitKeys = useRef<Set<string>>(new Set());
  const [localScores, setLocalScores] = useState<Map<number, string>>(() => loadDraft(draftScope, examId));
  const [studentSearch, setStudentSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  // 저장 직후 행에 1.2초 색상 펄스 — 토스트 외 즉시 시각 표식
  const [justSaved, setJustSaved] = useState<Set<number>>(new Set());
  useEffect(() => { setLocalScores(loadDraft(draftScope, examId)); }, [draftScope, examId]);
  useEffect(() => {
    setStudentSearch("");
    setReviewFilter("all");
  }, [examId]);
  useEffect(() => {
    if (!results?.length) return;
    const firstEnrollmentId = getExamResultEnrollmentId(results[0]);
    if (firstEnrollmentId == null) return;
    const t = setTimeout(() => inputRefs.current.get(firstEnrollmentId)?.focus(), 50);
    return () => clearTimeout(t);
  }, [examId, results]);

  const updateMut = useMutation({
    mutationFn: ({ enrollmentId, score, maxScore }: { enrollmentId: number; score: number; maxScore: number }) =>
      updateResult(sessionId, examId, enrollmentId, { score, maxScore }),
    // 옵티미스틱 업데이트 — refetch 사이클(invalidate 후 서버 응답까지 ~300-500ms) 동안
    // 행이 옛 값으로 잠깐 표시되는 racing 차단. onError에서 롤백.
    onMutate: async (variables) => {
      const qk = teacherScoresQueryKeys.examResults(examId);
      await qc.cancelQueries({ queryKey: qk });
      const previous = qc.getQueryData<TeacherExamResultRow[]>(qk);
      qc.setQueryData<TeacherExamResultRow[]>(qk, (prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        let matched = false;
        const next = rows.map((r) => {
          if (getExamResultEnrollmentId(r) !== variables.enrollmentId) return r;
          matched = true;
          return {
            ...r,
            exam_score: variables.score,
            final_score: variables.score,
            total_score: variables.score,
            exam_max_score: variables.maxScore,
            max_score: variables.maxScore,
          };
        });
        if (matched) return next;

        const virtualRow = results?.find((r) => getExamResultEnrollmentId(r) === variables.enrollmentId);
        return [
          ...next,
          {
            ...(virtualRow ?? {}),
            enrollment_id: variables.enrollmentId,
            student_name: virtualRow?.student_name ?? "이름 없음",
            exam_score: variables.score,
            final_score: variables.score,
            total_score: variables.score,
            exam_max_score: variables.maxScore,
            max_score: variables.maxScore,
          },
        ];
      });
      return { previous };
    },
    onSuccess: (_data, variables) => {
      setLocalScores((prev) => {
        const next = new Map(prev);
        next.delete(variables.enrollmentId);
        saveDraft(draftScope, examId, next);
        return next;
      });
      setJustSaved((prev) => new Set(prev).add(variables.enrollmentId));
      setTimeout(() => {
        setJustSaved((prev) => {
          const next = new Set(prev);
          next.delete(variables.enrollmentId);
          return next;
        });
      }, 1200);
      invalidateTeacherExamResultQueries(qc, examId);
      void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      const student = results?.find((r) => getExamResultEnrollmentId(r) === variables.enrollmentId);
      const name = student?.student_name ?? "";
      feedback.success(name ? `${name} 점수가 저장되었습니다.` : "점수가 저장되었습니다.");
    },
    onError: (e, _vars, ctx?: { previous?: TeacherExamResultRow[] }) => {
      qc.setQueryData(teacherScoresQueryKeys.examResults(examId), ctx?.previous);
      feedback.error(extractApiError(e, "저장 실패"));
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      pendingSubmitKeys.current.delete(`${variables.enrollmentId}:${variables.score}`);
    },
  });

  const setCachedCorrection = useCallback((
    enrollmentId: number,
    patch: Pick<ScoreBlock, "correction_status" | "correction_completed_at" | "correction_note" | "correction_updated_at" | "teacher_resolved">,
  ) => {
    qc.setQueryData<SessionScoresResponse>(
      scoresQueryKeys.sessionScores(sessionId),
      (previous) => previous ? {
        ...previous,
        rows: previous.rows.map((row) => row.enrollment_id !== enrollmentId ? row : {
          ...row,
          exams: row.exams.map((exam) => exam.exam_id !== examId ? exam : {
            ...exam,
            block: { ...exam.block, ...patch },
          }),
        }),
      } : previous,
    );
  }, [examId, qc, sessionId]);

  const reviewMut = useMutation({
    mutationFn: ({ enrollmentId, completed }: { enrollmentId: number; completed: boolean }) => (
      patchAssessmentCorrection(sessionId, {
        enrollment_id: enrollmentId,
        source_type: "exam",
        source_id: examId,
        completed,
        note: correctionByEnrollment.get(enrollmentId)?.correction_note || "현장 오답 해결 확인",
        expected_updated_at: correctionByEnrollment.get(enrollmentId)?.correction_updated_at ?? null,
      })
    ),
    onMutate: async ({ enrollmentId, completed }) => {
      const queryKey = scoresQueryKeys.sessionScores(sessionId);
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<SessionScoresResponse>(queryKey);
      setCachedCorrection(enrollmentId, {
        correction_status: completed ? "COMPLETED" : "PENDING",
        correction_completed_at: completed ? new Date().toISOString() : null,
        correction_note: correctionByEnrollment.get(enrollmentId)?.correction_note ?? "",
        correction_updated_at: correctionByEnrollment.get(enrollmentId)?.correction_updated_at ?? null,
        teacher_resolved: completed,
      });
      return { previous };
    },
    onSuccess: (data, variables) => {
      setCachedCorrection(variables.enrollmentId, data);
      const student = results.find((row) => getExamResultEnrollmentId(row) === variables.enrollmentId);
      feedback.success(`${student?.student_name ?? "학생"}을 ${wrongCompletionOnly
        ? variables.completed ? "오답 완료" : "오답 미완료"
        : variables.completed ? "원점수 유지·교사 통과" : "보완 필요"}로 저장했습니다.`);
    },
    onError: (error, _variables, context?: { previous?: SessionScoresResponse }) => {
      qc.setQueryData(scoresQueryKeys.sessionScores(sessionId), context?.previous);
      feedback.error(extractApiError(error, "오답 상태를 저장하지 못했습니다."));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      void qc.invalidateQueries({ queryKey: teacherScoresQueryKeys.examResults(examId) });
    },
  });

  const handleSubmit = useCallback(
    (enrollmentId: number, maxScore: number) => {
      const val = localScores.get(enrollmentId);
      if (val == null || val === "") return;
      if (!allowedEnrollmentIds.has(enrollmentId)) {
        feedback.error("이 차시의 대상 학생만 점수를 입력할 수 있습니다.");
        return;
      }
      const num = Number(val);
      if (isNaN(num)) {
        feedback.error("숫자만 입력하세요.");
        return;
      }
      if (num < 0 || num > maxScore) {
        feedback.error(`0~${maxScore} 사이의 점수를 입력하세요.`);
        return;
      }
      const submitKey = `${enrollmentId}:${num}`;
      if (pendingSubmitKeys.current.has(submitKey)) return;
      pendingSubmitKeys.current.add(submitKey);
      updateMut.mutate({ enrollmentId, score: num, maxScore });
    },
    [allowedEnrollmentIds, localScores, updateMut],
  );

  const focusNext = useCallback(
    (currentEnrollmentId: number) => {
      if (!results) return;
      const idx = results.findIndex((r) => getExamResultEnrollmentId(r) === currentEnrollmentId);
      if (idx >= 0 && idx < results.length - 1) {
        const nextEnrollmentId = getExamResultEnrollmentId(results[idx + 1]);
        if (nextEnrollmentId != null) inputRefs.current.get(nextEnrollmentId)?.focus();
      }
    },
    [results],
  );

  // 합계/평균 KPI (draft 우선)
  const stats = useMemo(() => {
    if (!results?.length) return null;
    const scores: number[] = [];
    let passed = 0;
    for (const r of results) {
      const enrollmentId = getExamResultEnrollmentId(r);
      if (enrollmentId == null) continue;
      const draft = localScores.get(enrollmentId);
      const final = getExamResultScore(r);
      let sc: number | null = null;
      if (draft != null && draft !== "" && !isNaN(Number(draft))) sc = Number(draft);
      else if (final != null) sc = Number(final);
      if (sc != null) {
        scores.push(sc);
        if (examPassScore != null && sc >= examPassScore) passed += 1;
      }
    }
    const entered = scores.length;
    const total = results.length;
    const avg = entered > 0 ? scores.reduce((a, b) => a + b, 0) / entered : null;
    const passRate = entered > 0 && examPassScore != null ? Math.round((passed / entered) * 100) : null;
    return { entered, total, avg, passRate };
  }, [results, localScores, examPassScore]);
  const reviewCounts = useMemo(() => {
    const counts = { all: results.length, pending: 0, resolved: 0, waiting: 0 };
    for (const row of results) {
      const enrollmentId = getExamResultEnrollmentId(row);
      if (enrollmentId == null) continue;
      counts[correctionBucket(correctionByEnrollment.get(enrollmentId)?.correction_status)] += 1;
    }
    return counts;
  }, [correctionByEnrollment, results]);
  const visibleResults = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase("ko-KR");
    return results.filter((row) => {
      const enrollmentId = getExamResultEnrollmentId(row);
      if (enrollmentId == null) return false;
      const matchesName = !query
        || (row.student_name ?? "").toLocaleLowerCase("ko-KR").includes(query);
      const bucket = correctionBucket(correctionByEnrollment.get(enrollmentId)?.correction_status);
      return matchesName && (reviewFilter === "all" || bucket === reviewFilter);
    });
  }, [correctionByEnrollment, results, reviewFilter, studentSearch]);
  const reviewTotal = reviewCounts.pending + reviewCounts.resolved;
  const reviewPercent = reviewTotal > 0
    ? Math.round((reviewCounts.resolved / reviewTotal) * 100)
    : 0;

  // 첫 진입 skeleton — 시험 칩만 보이고 행이 비는 시각 공백 해소
  if (resultsLoading || rosterLoading || scoreSheetLoading) return <ScoreEntrySkeleton />;
  if (!results?.length)
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="이 시험에 등록된 학생이 없습니다"
        description="차시에 수강생을 등록하거나 응시 대상을 선택하면 점수 입력 행이 표시됩니다."
      />
    );

  return (
    <div className="flex flex-col gap-2">
      {/* KPI 1줄 — 입력 진행 + 평균 (+ 합격률, pass_score > 0 일 때만) */}
      {stats && (() => {
        // pass_score=0/null 은 합격선 의미 없음 → KPI 합격 타일 숨김
        const showPass = examPassScore != null && examPassScore > 0;
        return (
          <div
            className={cx(
              "grid gap-2",
              showPass ? styles.kpiGridThree : styles.kpiGridTwo,
            )}
          >
            <KpiTile label="입력" value={`${stats.entered}/${stats.total}`} />
            <KpiTile
              label="평균"
              value={stats.avg != null ? stats.avg.toFixed(1) : "-"}
              tone={scoreTone(stats.avg, examMaxScore)}
            />
            {showPass && (
              <KpiTile
                label={`합격(≥${examPassScore})`}
                value={stats.passRate != null ? `${stats.passRate}%` : "-"}
                tone={rateTone(stats.passRate)}
              />
            )}
          </div>
        );
      })()}

      <section className={styles.reviewOverview} aria-label="테스트 오답 확인 현황">
        <div className={styles.reviewHeader}>
          <div>
            <strong>교사 최종 판정</strong>
            <span>{reviewTotal > 0 ? `${reviewCounts.resolved}/${reviewTotal} 처리` : "채점 후 상태가 표시됩니다"}</span>
          </div>
          {reviewTotal > 0 && <b>{reviewPercent}%</b>}
        </div>
        {reviewTotal > 0 && (
          <progress
            className={styles.reviewProgress}
            aria-label="테스트 오답 처리율"
            max={100}
            value={reviewPercent}
          />
        )}
        <input
          type="search"
          value={studentSearch}
          onChange={(event) => setStudentSearch(event.target.value)}
          className={styles.studentSearch}
          placeholder="학생 이름 검색"
          aria-label="학생 이름 검색"
        />
        <div className={styles.reviewFilters} role="group" aria-label="테스트 오답 확인 학생 필터">
          <ReviewFilterButton active={reviewFilter === "all"} onClick={() => setReviewFilter("all")} label={`전체 ${reviewCounts.all}`} />
          <ReviewFilterButton active={reviewFilter === "pending"} onClick={() => setReviewFilter("pending")} label={`확인 필요 ${reviewCounts.pending}`} />
          <ReviewFilterButton active={reviewFilter === "resolved"} onClick={() => setReviewFilter("resolved")} label={`처리됨 ${reviewCounts.resolved}`} />
          <ReviewFilterButton active={reviewFilter === "waiting"} onClick={() => setReviewFilter("waiting")} label={`채점 대기 ${reviewCounts.waiting}`} />
        </div>
      </section>

      {visibleResults.length === 0 && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="조건에 맞는 학생이 없습니다"
          description="이름이나 오답 상태 필터를 바꿔 다시 확인해 보세요."
        />
      )}

      {visibleResults.map((r) => {
        const enrollmentId = getExamResultEnrollmentId(r);
        if (enrollmentId == null) return null;
        const existing = getExamResultScore(r);
        const display = localScores.get(enrollmentId) ?? (existing != null ? String(existing) : "");
        const maxScore = getExamResultMaxScore(r, examMaxScore ?? 100);
        const name = r.student_name ?? "이름 없음";
        const draftVal = localScores.get(enrollmentId);
        const draftNum = draftVal != null && draftVal !== "" ? Number(draftVal) : NaN;
        const isInvalid = !isNaN(draftNum) && (draftNum < 0 || draftNum > maxScore);
        const correctionStatus = correctionByEnrollment.get(enrollmentId)?.correction_status;
        const draftDirty = localScores.has(enrollmentId);
        const reviewSaving = reviewMut.isPending
          && reviewMut.variables?.enrollmentId === enrollmentId;

        const saved = justSaved.has(enrollmentId);
        return (
          <div
            key={enrollmentId}
            className={cx(
              styles.scoreRow,
              saved && styles.scoreRowSaved,
            )}
          >
            <div className={styles.scoreRowMain}>
              <span
                className={cx("ds-text-name font-semibold flex-1 min-w-0 truncate", styles.title)}
              >
                {name}
              </span>
              <AchievementBadge passed={r.final_pass ?? r.passed} achievement={r.achievement} />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(enrollmentId, el);
                  }}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={display}
                  placeholder="-"
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocalScores((p) => {
                      const next = new Map(p).set(enrollmentId, v);
                      saveDraft(draftScope, examId, next);
                      return next;
                    });
                  }}
                  onBlur={() => handleSubmit(enrollmentId, maxScore)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit(enrollmentId, maxScore);
                      focusNext(enrollmentId);
                    }
                  }}
                  className={cx(
                    "text-center text-lg font-bold outline-none",
                    styles.scoreInput,
                    isInvalid && styles.scoreInputInvalid,
                  )}
                />
                <span className={cx("text-[13px]", styles.mutedText)}>
                  / {maxScore}
                </span>
              </div>
            </div>
            <div className={styles.reviewRow}>
              <span>{draftDirty
                ? `점수를 먼저 저장하면 ${wrongCompletionOnly ? "오답 상태" : "최종 판정"}을 바꿀 수 있습니다.`
                : wrongCompletionOnly ? "오답 확인 상태" : "원점수 유지 판정"}</span>
              <ReviewStatusControl
                status={correctionStatus}
                disabled={draftDirty || reviewSaving}
                saving={reviewSaving}
                studentName={name}
                wrongCompletionOnly={wrongCompletionOnly}
                onToggle={() => reviewMut.mutate({
                  enrollmentId,
                  completed: correctionStatus !== "COMPLETED",
                })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreEntrySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <div
        className={cx("grid gap-2", styles.kpiGridThree)}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={styles.skeletonTile}
          />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={styles.skeletonRow}
        />
      ))}
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const valueClass =
    tone === "success"
      ? styles.successText
      : tone === "warning"
        ? styles.warningText
        : tone === "danger"
          ? styles.dangerText
          : tone === "muted"
            ? styles.mutedText
            : styles.title;

  return (
    <div
      className={cx("rounded-lg flex flex-col items-center justify-center py-2", styles.kpiTile)}
    >
      <span className={cx("text-base font-bold leading-tight", valueClass)}>
        {value}
      </span>
      <span className={cx("text-[11px] mt-0.5", styles.mutedText)}>
        {label}
      </span>
    </div>
  );
}

function ReviewFilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={styles.reviewFilter}
      data-active={active}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ReviewStatusControl({
  status,
  disabled,
  saving,
  studentName,
  wrongCompletionOnly,
  onToggle,
}: {
  status: CorrectionStatus;
  disabled: boolean;
  saving: boolean;
  studentName: string;
  wrongCompletionOnly: boolean;
  onToggle: () => void;
}) {
  if (status === "NOT_REQUIRED") {
    return <Badge size="sm" tone="success">{wrongCompletionOnly ? "오답 완료" : "보완 불필요"}</Badge>;
  }
  if (status == null) {
    return <Badge size="sm" tone="neutral">채점 대기</Badge>;
  }

  const completed = status === "COMPLETED";
  const currentLabel = wrongCompletionOnly
    ? completed ? "오답 완료" : "오답 미완료"
    : completed ? "교사 판정 통과" : "교사 판정 보완 필요";
  const nextLabel = wrongCompletionOnly
    ? completed ? "오답 미완료" : "오답 완료"
    : completed ? "보완 필요" : "통과";
  return (
    <button
      type="button"
      className={styles.reviewToggle}
      data-completed={completed}
      aria-pressed={completed}
      aria-label={`${studentName} ${currentLabel}; 눌러서 ${nextLabel}로 변경`}
      disabled={disabled}
      onClick={onToggle}
    >
      {saving ? "저장 중" : wrongCompletionOnly ? currentLabel : completed ? "교사 통과" : "보완 필요"}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx("flex p-1 cursor-pointer", styles.backButton)}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
