// PATH: src/app_teacher/domains/exams/pages/ExamDetailPage.tsx
// 시험 상세 — 제출현황 + 간이 채점 (admin endpoint SSOT, enrollment_id schema)
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
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
import styles from "./ExamDetailPage.module.css";

type TeacherExamDetail = {
  id: number;
  title: string;
  max_score: number | null;
  session_ids: number[];
};

type ExamResultRow = {
  enrollment_id: number;
  student_name: string;
  exam_score: number | null;
  final_score: number | null;
  exam_max_score: number | null;
  passed: boolean | null;
  final_pass: boolean | null;
  achievement: string | null;
};

type LectureEnrollment = {
  id: number;
  status: string | null;
  student_name: string;
};

type TeacherSession = {
  lecture_id: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.results) ? record.results : [];
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getStudentName(record: Record<string, unknown>): string {
  const student = asRecord(record.student);
  return (
    toStringValue(record.student_name)
    ?? toStringValue(student.name)
    ?? toStringValue(record.name)
    ?? "이름 없음"
  );
}

function normalizeExam(value: unknown): TeacherExamDetail | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;
  const sessionIds = Array.isArray(record.session_ids)
    ? record.session_ids.map(toNumber).filter((v): v is number => v != null)
    : [];

  return {
    id,
    title: toStringValue(record.title) ?? "시험",
    max_score: toNumber(record.max_score),
    session_ids: sessionIds,
  };
}

function normalizeResultRow(value: unknown): ExamResultRow | null {
  const record = asRecord(value);
  const enrollmentId = toNumber(record.enrollment_id ?? record.enrollment);
  if (enrollmentId == null) return null;

  return {
    enrollment_id: enrollmentId,
    student_name: getStudentName(record),
    exam_score: toNumber(record.exam_score ?? record.score),
    final_score: toNumber(record.final_score),
    exam_max_score: toNumber(record.exam_max_score ?? record.max_score),
    passed: toBoolean(record.passed),
    final_pass: toBoolean(record.final_pass),
    achievement: toStringValue(record.achievement),
  };
}

function normalizeResultRows(value: unknown): ExamResultRow[] {
  return unwrapList(value)
    .map(normalizeResultRow)
    .filter((row): row is ExamResultRow => row != null);
}

function normalizeEnrollment(value: unknown): LectureEnrollment | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;

  return {
    id,
    status: toStringValue(record.status),
    student_name: getStudentName(record),
  };
}

function normalizeEnrollments(value: unknown): LectureEnrollment[] {
  return unwrapList(value)
    .map(normalizeEnrollment)
    .filter((row): row is LectureEnrollment => row != null);
}

function normalizeSession(value: unknown): TeacherSession {
  const record = asRecord(value);
  return {
    lecture_id: toNumber(record.lecture ?? record.lecture_id),
  };
}

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const eid = Number(examId);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: exam, isLoading: loadingExam } = useQuery({
    queryKey: ["teacher-exam", eid],
    queryFn: async () => normalizeExam(await fetchExam(eid)),
    enabled: Number.isFinite(eid),
  });

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ["teacher-exam-results", eid],
    queryFn: async () => normalizeResultRows(await fetchExamResults(eid)),
    enabled: Number.isFinite(eid),
  });

  // enrollment fallback — admin endpoint 는 result row 있는 학생만 반환.
  // 시험 만든 직후엔 빈 화면이라 학원장이 채점 시작 못 함. exam→session→lecture→enrollments 로 base 확보.
  const firstSessionId = Array.isArray(exam?.session_ids) && exam.session_ids.length > 0
    ? exam.session_ids[0]
    : null;
  const { data: firstSession } = useQuery({
    queryKey: ["teacher-exam-first-session", firstSessionId],
    queryFn: async () => normalizeSession(await fetchSession(firstSessionId!)),
    enabled: firstSessionId != null,
  });
  const lectureIdForEnrollments = firstSession?.lecture_id ?? null;
  const { data: enrollments } = useQuery({
    queryKey: ["teacher-exam-enrollments", lectureIdForEnrollments],
    queryFn: async () => normalizeEnrollments(await fetchLectureEnrollments(lectureIdForEnrollments!)),
    enabled: Number.isFinite(lectureIdForEnrollments),
  });

  if (loadingExam || loadingResults)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 찾을 수 없습니다" />;

  const hasScore = (r: ExamResultRow) => (r.final_score ?? r.exam_score) != null;

  // result row(점수 매겨진 행) + enrollment fallback(미응시 학생) merge.
  // 우선순위: result(server) 있으면 result, 없으면 enrollment 기반 가상 행.
  const resultByEnrollment = new Map<number, ExamResultRow>();
  for (const r of results ?? []) {
    resultByEnrollment.set(r.enrollment_id, r);
  }
  const activeEnrollments = (enrollments ?? []).filter((e) => e.status === "ACTIVE" || e.status == null);
  const merged = activeEnrollments.length > 0
    ? activeEnrollments.map((e) => {
        const fromResult = resultByEnrollment.get(e.id);
        if (fromResult) return fromResult;
        return {
          enrollment_id: e.id,
          student_name: e.student_name,
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
  const ungraded = merged.filter((r) => !hasScore(r));

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1 truncate`}>
          {exam.title}
        </h1>
        <button
          type="button"
          onClick={() => navigate(`/teacher/exams/${eid}/omr`)}
          className={`${styles.omrButton} flex items-center gap-1 text-[11px] font-semibold cursor-pointer`}
        >
          <Camera size={12} /> OMR
        </button>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className={`${styles.iconButton} flex p-1 cursor-pointer`}
        >
          <Settings size={ICON.md} />
        </button>
      </div>

      {/* Summary */}
      <div className={`${styles.summaryPanel} grid grid-cols-3 gap-2 rounded-xl`}>
        <StatBox label="만점" value={exam.max_score ?? "-"} />
        <StatBox label="학생" value={`${merged.length}`} tone="primary" />
        <StatBox label="채점" value={`${graded.length}/${merged.length}`} tone="success" />
      </div>

      {/* Ungraded list */}
      {ungraded.length > 0 && (
        <div className={`${styles.sectionPanel} rounded-xl`}>
          <h3 className={`${styles.title} text-sm font-bold mb-3`}>
            채점 대기 ({ungraded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {ungraded.map((r) => (
              <ResultRow key={r.enrollment_id} examId={eid} result={r} exam={exam} />
            ))}
          </div>
        </div>
      )}

      {/* Graded list */}
      {graded.length > 0 && (
        <div className={`${styles.sectionPanel} rounded-xl`}>
          <h3 className={`${styles.title} text-sm font-bold mb-3`}>
            채점 완료 ({graded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {graded.map((r) => (
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

function ResultRow({
  examId,
  result,
  exam,
}: {
  examId: number;
  result: ExamResultRow;
  exam: TeacherExamDetail;
}) {
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
    <div className={`${styles.resultRow} flex justify-between items-center py-2`}>
      <span className={`${styles.title} text-sm flex-1 min-w-0 truncate`}>{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <AchievementBadge passed={result.final_pass ?? result.passed} achievement={result.achievement} />
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setEditing(false); }
              }}
              placeholder="점수"
              className={`${styles.scoreInput} text-center text-sm font-bold outline-none`}
            />
            <span className={`${styles.mutedText} text-[12px]`}>/ {maxScore}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={mutation.isPending}
            className={`${styles.scoreButton} ${currentScore != null ? styles.scoreButtonScored : styles.scoreButtonPending} text-sm font-semibold px-3 py-1 rounded cursor-pointer`}
          >
            {mutation.isPending ? "저장 중…" : currentScore != null ? `${currentScore}/${maxScore}` : "채점"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`${STAT_TONE_CLASS[tone]} text-xl font-bold`}>
        {value}
      </span>
      <span className={`${styles.mutedText} text-[11px]`}>{label}</span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.backButton} flex p-1 cursor-pointer`}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

type StatTone = "default" | "primary" | "success";

const STAT_TONE_CLASS: Record<StatTone, string> = {
  default: styles.statDefault,
  primary: styles.statPrimary,
  success: styles.statSuccess,
};
