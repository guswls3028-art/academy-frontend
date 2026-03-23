/**
 * ExamResultPage — 시험 결과 상세
 * 대표 Result + ResultItem(문항별) 렌더링
 * 서버 권한 기반 정답 노출 (answer_visibility)
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useMyExamResult } from "@/student/domains/exams/hooks/useMyExamResult";
import { useMyExamResultItems } from "@/student/domains/exams/hooks/useMyExamResultItems";
import GradeBadge from "@/student/domains/grades/components/GradeBadge";

export default function ExamResultPage() {
  const { examId } = useParams();
  const safeId = Number(examId);

  const resultQ = useMyExamResult(Number.isFinite(safeId) ? safeId : undefined);
  const itemsQ = useMyExamResultItems(Number.isFinite(safeId) ? safeId : undefined);

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell title="시험 결과" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (resultQ.isLoading) {
    return (
      <StudentPageShell title="시험 결과">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 140, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (resultQ.isError || !resultQ.data) {
    return (
      <StudentPageShell title="시험 결과">
        <EmptyState
          title="결과를 불러오지 못했어요."
          description="아직 채점 전이거나, 시험에 응시하지 않았을 수 있어요."
        />
      </StudentPageShell>
    );
  }

  const r = resultQ.data;
  const items = itemsQ.data ?? [];
  const pct = r.max_score > 0 ? Math.round((r.total_score / r.max_score) * 100) : 0;
  const correctCount = items.filter((it) => it.is_correct).length;
  const wrongCount = items.length - correctCount;

  return (
    <StudentPageShell
      title="시험 결과"
      actions={
        <div style={{ display: "flex", gap: "var(--stu-space-3)" }}>
          <Link to="/student/grades" className="stu-cta-link">
            성적
          </Link>
          <Link
            to={`/student/exams/${safeId}`}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--stu-text-muted)",
              textDecoration: "none",
            }}
          >
            시험으로
          </Link>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-8)" }}>
        {/* ── Score Gauge ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--stu-space-4)", padding: "var(--stu-space-4) 0" }}>
          <ScoreGauge pct={pct} passed={r.is_pass} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {r.total_score} / {r.max_score}점
          </div>
          <GradeBadge passed={r.is_pass} />
          {r.submitted_at && (
            <div className="stu-muted" style={{ fontSize: 12 }}>
              {new Date(r.submitted_at).toLocaleDateString("ko-KR")} 제출
            </div>
          )}
        </div>

        {/* ── Correct/Wrong Bar ── */}
        {items.length > 0 && (
          <CorrectBar correct={correctCount} wrong={wrongCount} />
        )}

        {/* ── Per-question results (OMR Grid) ── */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: "var(--stu-space-4)" }}>
            문항별 결과
          </div>

          {itemsQ.isLoading && (
            <div className="stu-muted" style={{ fontSize: 13 }}>
              불러오는 중...
            </div>
          )}
          {itemsQ.isError && (
            <div style={{ fontSize: 13, color: "var(--stu-danger)" }}>
              문항별 결과를 불러오지 못했어요.
            </div>
          )}

          {!r.answers_visible && (
            <div
              className="stu-muted"
              style={{ fontSize: 13, padding: "var(--stu-space-3) 0" }}
            >
              정답은 비공개입니다.
              {r.answer_visibility === "after_closed" && " 시험 마감 후 공개됩니다."}
            </div>
          )}

          {items.length > 0 && (
            <QuestionGrid
              items={items}
              showAnswer={!!r.answers_visible}
              answersVisible={!!r.answers_visible}
            />
          )}

          {items.length === 0 && !itemsQ.isLoading && !itemsQ.isError && (
            <div className="stu-muted" style={{ fontSize: 13 }}>
              문항별 결과가 아직 없어요.
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}

/* ── Score Gauge (SVG) ── */

function ScoreGauge({ pct, passed }: { pct: number; passed: boolean }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;
  const color = passed ? "var(--stu-success)" : "var(--stu-danger)";

  return (
    <svg width={108} height={108} viewBox="0 0 108 108">
      <circle
        cx={54}
        cy={54}
        r={R}
        fill="none"
        stroke="var(--stu-surface-soft)"
        strokeWidth={10}
      />
      <circle
        cx={54}
        cy={54}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 54 54)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={54}
        y={54}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 24, fontWeight: 900, fill: "var(--stu-text)" }}
      >
        {pct}
      </text>
      <text
        x={54}
        y={72}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 600, fill: "var(--stu-text-muted)" }}
      >
        %
      </text>
    </svg>
  );
}

/* ── Correct/Wrong ratio bar ── */

function CorrectBar({ correct, wrong }: { correct: number; wrong: number }) {
  const total = correct + wrong;
  if (total === 0) return null;
  const cPct = (correct / total) * 100;

  return (
    <div
      style={{
        background: "var(--stu-surface-soft)",
        borderRadius: "var(--stu-radius)",
        padding: "var(--stu-space-5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: "var(--stu-space-3)",
        }}
      >
        <span style={{ color: "var(--stu-success-text)" }}>
          정답 {correct}문항
        </span>
        <span style={{ color: "var(--stu-danger-text)" }}>
          오답 {wrong}문항
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "var(--stu-danger)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${cPct}%`,
            background: "var(--stu-success)",
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ── Question Grid (OMR style) ── */

type QuestionItemData = {
  question_id: number;
  question_number: number;
  student_answer: string | null;
  correct_answer: string | null;
  score: number;
  max_score: number;
  is_correct: boolean;
};

function QuestionGrid({
  items,
  showAnswer,
  answersVisible,
}: {
  items: QuestionItemData[];
  showAnswer: boolean;
  answersVisible: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedItem = items.find((it) => it.question_number === selected);

  return (
    <div>
      {/* Grid — 한 줄에 5개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 6,
        }}
      >
        {items.map((it) => {
          const isSelected = selected === it.question_number;
          const chipBg = answersVisible
            ? it.is_correct
              ? "var(--stu-success-bg)"
              : "var(--stu-surface-soft)"
            : "var(--stu-surface-soft)";
          const chipBorder = answersVisible
            ? it.is_correct
              ? "1.5px solid var(--stu-success)"
              : "1.5px solid var(--stu-danger)"
            : "1.5px solid var(--stu-border)";

          return (
            <button
              key={`${it.question_id}-${it.question_number}`}
              type="button"
              onClick={() =>
                setSelected(isSelected ? null : it.question_number)
              }
              aria-pressed={isSelected}
              aria-label={`${it.question_number}번 ${answersVisible ? (it.is_correct ? "정답" : "오답") : ""}`}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                maxWidth: 40,
                borderRadius: 10,
                border: chipBorder,
                background: chipBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--stu-text)",
                padding: 0,
                outline: "none",
                boxShadow: isSelected
                  ? "0 0 0 2px var(--stu-primary)"
                  : "none",
                transform: isSelected ? "scale(1.08)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
            >
              {it.question_number}
            </button>
          );
        })}
      </div>

      {/* Expanded Detail */}
      {selectedItem && (
        <div
          style={{
            marginTop: "var(--stu-space-3)",
            border: "1px solid var(--stu-border)",
            borderRadius: "var(--stu-radius)",
            padding: "var(--stu-space-4)",
            background: selectedItem.is_correct
              ? "var(--stu-success-bg)"
              : "var(--stu-surface-soft)",
            animation: "stuSlideDown 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--stu-space-3)",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {selectedItem.question_number}번
            </span>
            <GradeBadge
              passed={selectedItem.is_correct}
              label={{ pass: "정답", fail: "오답" }}
            />
            <span
              className="stu-muted"
              style={{ fontSize: 12, marginLeft: "auto" }}
            >
              {selectedItem.score}/{selectedItem.max_score}점
            </span>
          </div>
          <div
            className="stu-muted"
            style={{ marginTop: "var(--stu-space-2)", fontSize: 13 }}
          >
            내 답: {selectedItem.student_answer ?? "-"}
            {showAnswer && selectedItem.correct_answer != null
              ? ` \u00B7 정답: ${selectedItem.correct_answer}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}
