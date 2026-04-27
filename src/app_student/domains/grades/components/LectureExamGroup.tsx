/**
 * 강좌별 시험 성적 그룹 — GradesPage에서 추출
 */
import { Link } from "react-router-dom";
import { IconExam, IconChevronRight } from "@student/shared/ui/icons/Icons";
import GradeBadge from "./GradeBadge";
import type { MyExamGradeSummary } from "../api/grades.api";

export type ExamGroup = {
  key: string;
  label: string;
  exams: MyExamGradeSummary[];
  /** 평균 백분율. null이면 표시 생략 (시간순 정렬 등 그룹 의미가 약한 경우) */
  avgPct: number | null;
};

function fmtScore(total: number | null, max: number): string {
  if (total == null) return "미응시";
  if (max <= 0) return `${total}점`;
  return `${total}/${max}점`;
}

export default function LectureExamGroup({ group }: { group: ExamGroup }) {
  return (
    <div>
      <LectureGroupHeader label={group.label} count={group.exams.length} avgPct={group.avgPct} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
        {group.exams.map((e) => (
          <Link
            key={e.exam_id}
            to={`/student/exams/${e.exam_id}/result`}
            className="stu-panel stu-panel--pressable stu-panel--accent"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-4)" }}>
              <div style={iconWrap}>
                <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {e.session_title && `${e.session_title} · `}
                  {fmtScore(e.total_score, e.max_score)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <GradeBadge passed={e.is_pass} achievement={e.achievement} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {e.rank != null && e.cohort_size != null && e.cohort_size > 1 && e.meta_status !== "NOT_SUBMITTED" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: "var(--stu-tint-primary)",
                        color: "var(--stu-primary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.rank}/{e.cohort_size}등
                    </span>
                  )}
                  {e.total_score != null && e.max_score > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--stu-text-muted)" }}>
                      {Math.round((e.total_score / e.max_score) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <IconChevronRight style={{ width: 18, height: 18, color: "var(--stu-text-muted)", flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LectureGroupHeader({ label, count, avgPct }: { label: string; count: number; avgPct: number | null }) {
  return (
    <div style={groupHeader}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--stu-text)" }}>{label}</div>
        <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {count}건{avgPct != null ? ` · 평균 ${avgPct}점` : ""}
        </div>
      </div>
    </div>
  );
}

const iconWrap: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  background: "var(--stu-surface-soft)", display: "grid", placeItems: "center", flexShrink: 0,
};

const groupHeader: React.CSSProperties = {
  display: "flex", alignItems: "center",
  padding: "var(--stu-space-4) var(--stu-space-5)",
  marginBottom: "var(--stu-space-2)",
  borderLeft: "4px solid var(--stu-primary)",
  background: "var(--stu-tint-primary)",
  borderRadius: "0 var(--stu-radius-xl) var(--stu-radius-xl) 0",
};
