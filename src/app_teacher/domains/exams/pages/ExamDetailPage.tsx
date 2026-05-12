// PATH: src/app_teacher/domains/exams/pages/ExamDetailPage.tsx
// 시험 상세 — 제출현황 + 간이 채점 (admin endpoint SSOT, enrollment_id schema)
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { Settings, Camera } from "@teacher/shared/ui/Icons";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchExam } from "../api";
// 사이드바 ResultsPage 와 동일 SSOT — admin endpoint(IsTeacherOrAdmin) enrollment_id schema
import { fetchExamResults } from "@teacher/domains/results/statsApi";
import { updateResult } from "@teacher/domains/scores/api";
import { fetchSession, fetchLectureEnrollments } from "@teacher/domains/lectures/api";
import ExamManageSheet from "../components/ExamManageSheet";

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const eid = Number(examId);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: exam, isLoading: loadingExam } = useQuery({
    queryKey: ["teacher-exam", eid],
    queryFn: () => fetchExam(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ["teacher-exam-results", eid],
    queryFn: () => fetchExamResults(eid),
    enabled: Number.isFinite(eid),
  });

  // enrollment fallback — admin endpoint 는 result row 있는 학생만 반환.
  // 시험 만든 직후엔 빈 화면이라 학원장이 채점 시작 못 함. exam→session→lecture→enrollments 로 base 확보.
  const firstSessionId = Array.isArray(exam?.session_ids) && exam.session_ids.length > 0
    ? exam.session_ids[0]
    : null;
  const { data: firstSession } = useQuery({
    queryKey: ["teacher-exam-first-session", firstSessionId],
    queryFn: () => fetchSession(firstSessionId!),
    enabled: firstSessionId != null,
  });
  const lectureIdForEnrollments = firstSession?.lecture ?? firstSession?.lecture_id ?? null;
  const { data: enrollments } = useQuery({
    queryKey: ["teacher-exam-enrollments", lectureIdForEnrollments],
    queryFn: () => fetchLectureEnrollments(lectureIdForEnrollments!),
    enabled: Number.isFinite(lectureIdForEnrollments),
  });

  if (loadingExam || loadingResults)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 찾을 수 없습니다" />;

  const hasScore = (r: any) => (r.final_score ?? r.exam_score) != null;

  // result row(점수 매겨진 행) + enrollment fallback(미응시 학생) merge.
  // 우선순위: result(server) 있으면 result, 없으면 enrollment 기반 가상 행.
  const resultByEnrollment = new Map<number, any>();
  for (const r of results ?? []) {
    if (r?.enrollment_id != null) resultByEnrollment.set(r.enrollment_id, r);
  }
  const activeEnrollments = (enrollments ?? []).filter((e: any) => e.status === "ACTIVE" || e.status == null);
  const merged = activeEnrollments.length > 0
    ? activeEnrollments.map((e: any) => {
        const fromResult = resultByEnrollment.get(e.id);
        if (fromResult) return fromResult;
        return {
          enrollment_id: e.id,
          student_name: e.student_name ?? e.student?.name ?? e.name ?? "이름 없음",
          exam_score: null,
          final_score: null,
          exam_max_score: exam.max_score ?? 100,
          passed: null,
          final_pass: null,
          achievement: null,
        };
      })
    : (results ?? []);

  const graded = merged.filter(hasScore);
  const ungraded = merged.filter((r: any) => !hasScore(r));

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {exam.title}
        </h1>
        <button onClick={() => navigate(`/teacher/exams/${eid}/omr`)}
          className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
          style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
          <Camera size={12} /> OMR
        </button>
        <button onClick={() => setManageOpen(true)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          <Settings size={ICON.md} />
        </button>
      </div>

      {/* Summary */}
      <div
        className="grid grid-cols-3 gap-2 rounded-xl"
        style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <StatBox label="만점" value={exam.max_score ?? "-"} />
        <StatBox label="학생" value={`${merged.length}`} color="var(--tc-primary)" />
        <StatBox label="채점" value={`${graded.length}/${merged.length}`} color="var(--tc-success)" />
      </div>

      {/* Ungraded list */}
      {ungraded.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>
            채점 대기 ({ungraded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {ungraded.map((r: any) => (
              <ResultRow key={r.enrollment_id} examId={eid} result={r} exam={exam} />
            ))}
          </div>
        </div>
      )}

      {/* Graded list */}
      {graded.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>
            채점 완료 ({graded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {graded.map((r: any) => (
              <ResultRow key={r.enrollment_id} examId={eid} result={r} exam={exam} />
            ))}
          </div>
        </div>
      )}

      {merged.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="이 시험에 연결된 학생이 없습니다" />
      )}

      <ExamManageSheet open={manageOpen} onClose={() => setManageOpen(false)} exam={exam} onDeleted={() => navigate(-1)} />
    </div>
  );
}

function ResultRow({ examId, result, exam }: { examId: number; result: any; exam: any }) {
  const qc = useQueryClient();
  const name = result.student_name ?? "이름 없음";
  const enrollmentId = result.enrollment_id;
  const currentScore = result.final_score ?? result.exam_score;
  const maxScore = result.exam_max_score ?? exam.max_score ?? 100;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(currentScore != null ? String(currentScore) : "");

  const mutation = useMutation({
    mutationFn: (score: number) => updateResult(examId, enrollmentId, { score, maxScore }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-exam-results", examId] });
      feedback.success(`${name} 점수가 저장되었습니다.`);
      setEditing(false);
    },
    onError: (e) => feedback.error(extractApiError(e, "점수 저장에 실패했습니다.")),
  });

  const startEdit = () => {
    setDraft(currentScore != null ? String(currentScore) : "");
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") { setEditing(false); return; }
    const score = Number(trimmed);
    if (!Number.isFinite(score) || score < 0) {
      feedback.error("점수는 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    if (Number.isFinite(maxScore) && maxScore > 0 && score > maxScore) {
      feedback.error(`점수는 0 ~ ${maxScore} 사이로 입력해 주세요.`);
      return;
    }
    mutation.mutate(score);
  };

  return (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--tc-text)" }}>{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <AchievementBadge passed={result.final_pass ?? result.passed} achievement={result.achievement} />
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setEditing(false); }
              }}
              placeholder="점수"
              className="text-center text-sm font-bold outline-none"
              style={{
                width: 64, height: 36,
                border: "1px solid var(--tc-primary)",
                borderRadius: "var(--tc-radius-sm)",
                background: "var(--tc-surface-soft)",
                color: "var(--tc-text)",
              }}
            />
            <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>/ {maxScore}</span>
          </div>
        ) : (
          <button
            onClick={startEdit}
            disabled={mutation.isPending}
            className="text-sm font-semibold px-3 py-1 rounded cursor-pointer"
            style={{
              background: currentScore != null ? "var(--tc-success-bg)" : "var(--tc-primary-bg)",
              color: currentScore != null ? "var(--tc-success)" : "var(--tc-primary)",
              border: "none",
              minHeight: "var(--tc-touch-min, 36px)",
            }}
          >
            {mutation.isPending ? "저장 중…" : currentScore != null ? `${currentScore}/${maxScore}` : "채점"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl font-bold" style={{ color: color ?? "var(--tc-text)" }}>
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
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
