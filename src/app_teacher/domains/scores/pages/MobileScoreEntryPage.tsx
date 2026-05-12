// PATH: src/app_teacher/domains/scores/pages/MobileScoreEntryPage.tsx
// 성적 입력 — 모바일 최적화. 숫자 키패드 + 자동 다음 포커스 + 만점/평균 KPI + 즉시 검증
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchSessionExams, fetchExamResults, updateResult } from "../api";
import { fetchSession, fetchLectureEnrollments } from "@teacher/domains/lectures/api";

export default function MobileScoreEntryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sid = Number(sessionId);

  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ["session-exams", sid],
    queryFn: () => fetchSessionExams(sid),
    enabled: Number.isFinite(sid),
  });

  // 신규 시험 진입 시 admin endpoint 가 빈 results 반환 → 학생 list 0명 표시 → 채점 시작 불가.
  // 차시 → 강의 → enrollments 로 base 확보 후 result merge.
  const { data: sessionDetail } = useQuery({
    queryKey: ["session-detail-for-scores", sid],
    queryFn: () => fetchSession(sid),
    enabled: Number.isFinite(sid),
  });
  const lectureIdForEnrollments = sessionDetail?.lecture ?? sessionDetail?.lecture_id ?? null;
  const { data: enrollments } = useQuery({
    queryKey: ["session-enrollments-for-scores", lectureIdForEnrollments],
    queryFn: () => fetchLectureEnrollments(lectureIdForEnrollments!),
    enabled: Number.isFinite(lectureIdForEnrollments),
  });

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const activeExamId = selectedExamId ?? exams?.[0]?.id ?? null;
  const activeExam = exams?.find((e: any) => e.id === activeExamId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          성적 입력
        </h1>
      </div>

      {examsLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : exams && exams.length > 0 ? (
        <>
          {/* Exam selector chips — 만점 라벨로 컨텍스트 부여 */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {exams.map((exam: any) => {
              const active = exam.id === activeExamId;
              return (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className="rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    padding: "8px 14px",
                    border: active ? "none" : "1px solid var(--tc-border)",
                    background: active ? "var(--tc-primary)" : "transparent",
                    color: active ? "#fff" : "var(--tc-text)",
                  }}
                >
                  {exam.title}{exam.max_score != null ? ` · ${exam.max_score}점` : ""}
                </button>
              );
            })}
          </div>
          {activeExamId && (
            <ScoreEntryList
              examId={activeExamId}
              examMaxScore={activeExam?.max_score ?? 100}
              examPassScore={activeExam?.pass_score ?? null}
              enrollments={enrollments ?? []}
            />
          )}
        </>
      ) : (
        <EmptyState scope="panel" tone="empty" title="이 차시에 연결된 시험이 없습니다" />
      )}
    </div>
  );
}

/** sessionStorage 보호: refetch/invalidate 후에도 미저장 입력값 유지. 탭 닫으면 제거. */
const draftKeyForExam = (examId: number) => `score_entry_draft_${examId}`;

function loadDraft(examId: number): Map<number, string> {
  try {
    const raw = sessionStorage.getItem(draftKeyForExam(examId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
}
function saveDraft(examId: number, m: Map<number, string>) {
  try {
    if (m.size === 0) {
      sessionStorage.removeItem(draftKeyForExam(examId));
      return;
    }
    const obj: Record<string, string> = {};
    m.forEach((v, k) => { obj[String(k)] = v; });
    sessionStorage.setItem(draftKeyForExam(examId), JSON.stringify(obj));
  } catch { /* quota exceeded — non-critical */ }
}

function ScoreEntryList({
  examId,
  examMaxScore,
  examPassScore,
  enrollments,
}: { examId: number; examMaxScore: number; examPassScore: number | null; enrollments: any[] }) {
  const qc = useQueryClient();
  const { data: rawResults, isLoading } = useQuery({
    queryKey: ["exam-results", examId],
    queryFn: () => fetchExamResults(examId),
    enabled: Number.isFinite(examId),
  });

  // result row + enrollment 매핑 — 점수 매겨진 학생은 result, 아닌 학생은 enrollment 기반 가상 row
  const results = useMemo(() => {
    const byEnrollment = new Map<number, any>();
    for (const r of rawResults ?? []) {
      if (r?.enrollment_id != null) byEnrollment.set(r.enrollment_id, r);
    }
    const active = (enrollments ?? []).filter((e: any) => e.status === "ACTIVE" || e.status == null);
    if (active.length === 0) return rawResults ?? [];
    return active.map((e: any) => {
      const fromResult = byEnrollment.get(e.id);
      if (fromResult) return fromResult;
      return {
        enrollment_id: e.id,
        student_name: e.student_name ?? e.student?.name ?? e.name ?? "이름 없음",
        exam_score: null,
        final_score: null,
        exam_max_score: examMaxScore,
        passed: null,
        final_pass: null,
        achievement: null,
      };
    });
  }, [rawResults, enrollments, examMaxScore]);

  // row 식별자 = enrollment_id (admin endpoint schema SSOT)
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const [localScores, setLocalScores] = useState<Map<number, string>>(() => loadDraft(examId));
  // 저장 직후 행에 1.2초 색상 펄스 — 토스트 외 즉시 시각 표식
  const [justSaved, setJustSaved] = useState<Set<number>>(new Set());
  useEffect(() => { setLocalScores(loadDraft(examId)); }, [examId]);
  useEffect(() => {
    if (!results?.length) return;
    const first = results[0];
    const t = setTimeout(() => inputRefs.current.get(first.enrollment_id)?.focus(), 50);
    return () => clearTimeout(t);
  }, [examId, results]);

  const updateMut = useMutation({
    mutationFn: ({ enrollmentId, score, maxScore }: { enrollmentId: number; score: number; maxScore: number }) =>
      updateResult(examId, enrollmentId, { score, maxScore }),
    // 옵티미스틱 업데이트 — refetch 사이클(invalidate 후 서버 응답까지 ~300-500ms) 동안
    // 행이 옛 값으로 잠깐 표시되는 racing 차단. onError에서 롤백.
    onMutate: async (variables) => {
      const qk = ["exam-results", examId] as const;
      await qc.cancelQueries({ queryKey: qk });
      const previous = qc.getQueryData<any[]>(qk);
      qc.setQueryData<any[]>(qk, (prev) =>
        Array.isArray(prev)
          ? prev.map((r) =>
              r.enrollment_id === variables.enrollmentId
                ? { ...r, exam_score: variables.score, final_score: variables.score }
                : r,
            )
          : prev,
      );
      return { previous };
    },
    onSuccess: (_data, variables) => {
      setLocalScores((prev) => {
        const next = new Map(prev);
        next.delete(variables.enrollmentId);
        saveDraft(examId, next);
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
      qc.invalidateQueries({ queryKey: ["exam-results", examId] });
      const student = results?.find((r: any) => r.enrollment_id === variables.enrollmentId);
      const name = student?.student_name ?? "";
      feedback.success(name ? `${name} 점수가 저장되었습니다.` : "점수가 저장되었습니다.");
    },
    onError: (e, _vars, ctx: any) => {
      if (ctx?.previous) qc.setQueryData(["exam-results", examId], ctx.previous);
      feedback.error(extractApiError(e, "저장 실패"));
    },
  });

  const handleSubmit = useCallback(
    (enrollmentId: number, maxScore: number) => {
      const val = localScores.get(enrollmentId);
      if (val == null || val === "") return;
      const num = Number(val);
      if (isNaN(num)) {
        feedback.error("숫자만 입력하세요.");
        return;
      }
      if (num < 0 || num > maxScore) {
        feedback.error(`0~${maxScore} 사이의 점수를 입력하세요.`);
        return;
      }
      updateMut.mutate({ enrollmentId, score: num, maxScore });
    },
    [localScores, updateMut],
  );

  const focusNext = useCallback(
    (currentEnrollmentId: number) => {
      if (!results) return;
      const idx = results.findIndex((r: any) => r.enrollment_id === currentEnrollmentId);
      if (idx >= 0 && idx < results.length - 1) {
        inputRefs.current.get(results[idx + 1].enrollment_id)?.focus();
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
      const draft = localScores.get(r.enrollment_id);
      const final = r.final_score ?? r.exam_score;
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

  // 첫 진입 skeleton — 시험 칩만 보이고 행이 비는 시각 공백 해소
  if (isLoading) return <ScoreEntrySkeleton />;
  if (!results?.length)
    return <EmptyState scope="panel" tone="empty" title="이 시험에 등록된 학생이 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {/* KPI 1줄 — 입력 진행 + 평균 (+ 합격률, pass_score > 0 일 때만) */}
      {stats && (() => {
        // pass_score=0/null 은 합격선 의미 없음 → KPI 합격 타일 숨김
        const showPass = examPassScore != null && examPassScore > 0;
        return (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: showPass ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
          >
            <KpiTile label="입력" value={`${stats.entered}/${stats.total}`} />
            <KpiTile
              label="평균"
              value={stats.avg != null ? stats.avg.toFixed(1) : "-"}
              color={
                stats.avg != null && stats.avg >= examMaxScore * 0.7
                  ? "var(--tc-success)"
                  : stats.avg != null && stats.avg >= examMaxScore * 0.4
                    ? "var(--tc-warn)"
                    : "var(--tc-text)"
              }
            />
            {showPass && (
              <KpiTile
                label={`합격(≥${examPassScore})`}
                value={stats.passRate != null ? `${stats.passRate}%` : "-"}
                color={
                  stats.passRate != null && stats.passRate >= 70
                    ? "var(--tc-success)"
                    : stats.passRate != null && stats.passRate >= 40
                      ? "var(--tc-warn)"
                      : "var(--tc-danger)"
                }
              />
            )}
          </div>
        );
      })()}

      {results.map((r: any) => {
        const enrollmentId = r.enrollment_id;
        const existing = r.final_score ?? r.exam_score;
        const display = localScores.get(enrollmentId) ?? (existing != null ? String(existing) : "");
        const maxScore = r.exam_max_score ?? r.max_score ?? examMaxScore ?? 100;
        const name = r.student_name ?? "이름 없음";
        const draftVal = localScores.get(enrollmentId);
        const draftNum = draftVal != null && draftVal !== "" ? Number(draftVal) : NaN;
        const isInvalid = !isNaN(draftNum) && (draftNum < 0 || draftNum > maxScore);

        const saved = justSaved.has(enrollmentId);
        return (
          <div
            key={enrollmentId}
            className="flex items-center gap-3 rounded-lg"
            style={{
              padding: "var(--tc-space-3) var(--tc-space-4)",
              // 명시 success 색상 — 토큰이 옅을 경우 대비. 페이드인 180ms로 단축해 학원장이 다음 행으로 넘기기 전 visible
              background: saved ? "rgba(34, 197, 94, 0.18)" : "var(--tc-surface)",
              border: saved ? "1.5px solid #22c55e" : "1px solid var(--tc-border)",
              transition: "background 180ms ease-out, border-color 180ms ease-out",
              boxShadow: saved ? "0 0 0 3px rgba(34, 197, 94, 0.12)" : "none",
            }}
          >
            <span
              className="ds-text-name font-semibold flex-1 min-w-0 truncate"
              style={{ color: "var(--tc-text)" }}
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
                inputMode="numeric"
                pattern="[0-9]*"
                value={display}
                placeholder="-"
                onChange={(e) => {
                  const v = e.target.value;
                  setLocalScores((p) => {
                    const next = new Map(p).set(enrollmentId, v);
                    saveDraft(examId, next);
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
                className="text-center text-lg font-bold outline-none"
                style={{
                  width: 64,
                  height: 40,
                  border: isInvalid ? "1px solid var(--tc-danger)" : "1px solid var(--tc-border-strong)",
                  borderRadius: "var(--tc-radius-sm)",
                  background: isInvalid ? "var(--tc-danger-bg, #fef2f2)" : "var(--tc-surface-soft)",
                  color: isInvalid ? "var(--tc-danger)" : "var(--tc-text)",
                }}
              />
              <span className="text-[13px]" style={{ color: "var(--tc-text-muted)" }}>
                / {maxScore}
              </span>
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
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 56,
              borderRadius: "var(--tc-radius)",
              background: "var(--tc-surface-soft)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: "var(--tc-radius)",
            background: "var(--tc-surface-soft)",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center py-2"
      style={{
        background: "var(--tc-surface)",
        border: "1px solid var(--tc-border)",
      }}
    >
      <span className="text-base font-bold leading-tight" style={{ color: color ?? "var(--tc-text)" }}>
        {value}
      </span>
      <span className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
