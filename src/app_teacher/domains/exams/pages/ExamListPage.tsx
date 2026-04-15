// PATH: src/app_teacher/domains/exams/pages/ExamListPage.tsx
// 시험/과제 목록 — 탭 전환, 제출현황 진행률
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchExams, fetchHomeworks } from "../api";

type Tab = "exam" | "homework";

export default function ExamListPage() {
  const [tab, setTab] = useState<Tab>("exam");

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>
        시험 / 과제
      </h2>

      {/* Tabs */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--tc-border)", background: "var(--tc-surface-soft)" }}
      >
        {(["exam", "homework"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 text-sm font-semibold py-2.5 cursor-pointer"
            style={{
              border: "none",
              background: tab === t ? "var(--tc-primary)" : "transparent",
              color: tab === t ? "#fff" : "var(--tc-text-secondary)",
              transition: "all var(--tc-motion-fast)",
            }}
          >
            {t === "exam" ? "시험" : "과제"}
          </button>
        ))}
      </div>

      {tab === "exam" ? <ExamTab /> : <HomeworkTab />}
    </div>
  );
}

function ExamTab() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: () => fetchExams(),
    staleTime: 60_000,
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!exams?.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 시험이 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {exams.map((e: any) => (
        <button
          key={e.id}
          onClick={() => navigate(`/teacher/exams/${e.id}`)}
          className="flex flex-col gap-1.5 rounded-xl w-full text-left cursor-pointer"
          style={{
            padding: "var(--tc-space-4)",
            background: "var(--tc-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <div className="flex justify-between items-start gap-2">
            <span className="text-[15px] font-semibold flex-1" style={{ color: "var(--tc-text)" }}>
              {e.title}
            </span>
            <ExamTypeBadge type={e.exam_type} />
          </div>
          <div className="flex gap-3 text-xs" style={{ color: "var(--tc-text-muted)" }}>
            {e.session_title && <span>{e.session_title}</span>}
            {e.max_score != null && <span>만점 {e.max_score}</span>}
            {e.result_count != null && e.enrollment_count != null && (
              <span>
                제출 {e.result_count}/{e.enrollment_count}
              </span>
            )}
          </div>
          {e.enrollment_count > 0 && (
            <ProgressBar current={e.result_count ?? 0} total={e.enrollment_count} />
          )}
        </button>
      ))}
    </div>
  );
}

function HomeworkTab() {
  const navigate = useNavigate();
  const { data: hws, isLoading } = useQuery({
    queryKey: ["teacher-homeworks"],
    queryFn: () => fetchHomeworks(),
    staleTime: 60_000,
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!hws?.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 과제가 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {hws.map((h: any) => (
        <button
          key={h.id}
          onClick={() => navigate(`/teacher/homeworks/${h.id}`)}
          className="flex flex-col gap-1.5 rounded-xl w-full text-left cursor-pointer"
          style={{
            padding: "var(--tc-space-4)",
            background: "var(--tc-surface)",
            border: "1px solid var(--tc-border)",
          }}
        >
          <span className="text-[15px] font-semibold" style={{ color: "var(--tc-text)" }}>
            {h.title}
          </span>
          <div className="flex gap-3 text-xs" style={{ color: "var(--tc-text-muted)" }}>
            {h.session_title && <span>{h.session_title}</span>}
            {h.due_date && <span>마감 {h.due_date}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function ExamTypeBadge({ type }: { type?: string }) {
  const label = type === "template" ? "템플릿" : "일반";
  const color = type === "template" ? "var(--tc-info)" : "var(--tc-text-muted)";
  return (
    <span
      className="text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--tc-border)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "var(--tc-success)" : "var(--tc-primary)",
            transition: "width var(--tc-motion-base)",
          }}
        />
      </div>
      <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--tc-text-muted)" }}>
        {pct}%
      </span>
    </div>
  );
}
