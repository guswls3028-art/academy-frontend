// PATH: src/app_teacher/domains/exams/pages/ExamListPage.tsx
// 시험/과제 목록 — 상태(진행/마감/설정중) 뱃지 + 활성 우선 정렬 + 카드 톤 통일.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Plus } from "@teacher/shared/ui/Icons";
import { Badge, type BadgeTone } from "@teacher/shared/ui/Badge";
import { fetchExams, fetchHomeworks } from "../api";
import ExamFormSheet from "../components/ExamFormSheet";

type Tab = "exam" | "homework";
type ItemStatus = "DRAFT" | "OPEN" | "CLOSED" | undefined;

export default function ExamListPage() {
  const [tab, setTab] = useState<Tab>("exam");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>
          시험 / 과제
        </h2>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> {tab === "exam" ? "시험" : "과제"} 생성
        </button>
      </div>

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

      <ExamFormSheet open={createOpen} onClose={() => setCreateOpen(false)} mode={tab} />
    </div>
  );
}

/* ───────────────────────── Status helpers ─────────────────────────
 * 시험과 과제 모두 status: DRAFT | OPEN | CLOSED 동일 enum.
 * 진행 중 > 설정 중 > 마감 순으로 정렬해 액션이 필요한 항목을 위로.
 */
function statusBadge(status: ItemStatus): { label: string; tone: BadgeTone } {
  if (status === "OPEN") return { label: "진행", tone: "success" };
  if (status === "DRAFT") return { label: "설정 중", tone: "warning" };
  return { label: "마감", tone: "neutral" };
}

function statusOrder(status: ItemStatus): number {
  if (status === "OPEN") return 0;
  if (status === "DRAFT") return 1;
  return 2;
}

function ExamTab() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: () => fetchExams(),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    const list = (exams ?? []).slice() as Array<{
      id: number;
      title: string;
      status?: ItemStatus;
      exam_type?: string;
      max_score?: number;
      subject?: string;
      created_at?: string;
    }>;
    list.sort((a, b) => {
      const so = statusOrder(a.status) - statusOrder(b.status);
      if (so !== 0) return so;
      // 같은 상태 안에서는 최신순 (created_at desc)
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
    return list;
  }, [exams]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!sorted.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 시험이 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((e) => {
        const sb = statusBadge(e.status);
        const isClosed = e.status === "CLOSED";
        return (
          <button
            key={e.id}
            onClick={() => navigate(`/teacher/exams/${e.id}`)}
            className="flex flex-col gap-1.5 rounded-xl w-full text-left cursor-pointer"
            style={{
              padding: "var(--tc-space-4)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
              opacity: isClosed ? 0.78 : 1,
              transition: "opacity var(--tc-motion-fast), background var(--tc-motion-fast)",
            }}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge tone={sb.tone} size="sm">{sb.label}</Badge>
                <span
                  className="text-[15px] font-semibold truncate"
                  style={{ color: "var(--tc-text)" }}
                >
                  {e.title}
                </span>
              </div>
              <ExamTypeBadge type={e.exam_type} />
            </div>
            <div className="flex gap-3 text-xs flex-wrap" style={{ color: "var(--tc-text-muted)" }}>
              {e.subject && <span>{e.subject}</span>}
              {e.max_score != null && <span>만점 {e.max_score}점</span>}
            </div>
          </button>
        );
      })}
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

  const sorted = useMemo(() => {
    const list = (hws ?? []).slice() as Array<{
      id: number;
      title: string;
      status?: ItemStatus;
      due_date?: string;
      created_at?: string;
    }>;
    list.sort((a, b) => {
      const so = statusOrder(a.status) - statusOrder(b.status);
      if (so !== 0) return so;
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
    return list;
  }, [hws]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!sorted.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 과제가 없습니다" />;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((h) => {
        const sb = statusBadge(h.status);
        const isClosed = h.status === "CLOSED";
        return (
          <button
            key={h.id}
            onClick={() => navigate(`/teacher/homeworks/${h.id}`)}
            className="flex flex-col gap-1.5 rounded-xl w-full text-left cursor-pointer"
            style={{
              padding: "var(--tc-space-4)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
              opacity: isClosed ? 0.78 : 1,
              transition: "opacity var(--tc-motion-fast), background var(--tc-motion-fast)",
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge tone={sb.tone} size="sm">{sb.label}</Badge>
              <span
                className="text-[15px] font-semibold truncate"
                style={{ color: "var(--tc-text)" }}
              >
                {h.title}
              </span>
            </div>
            {h.due_date && (
              <div className="flex gap-3 text-xs" style={{ color: "var(--tc-text-muted)" }}>
                <span>마감 {h.due_date}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ExamTypeBadge({ type }: { type?: string }) {
  // exam_type: TEMPLATE/REGULAR (uppercase) or template/regular (legacy lowercase) 모두 대응.
  const isTemplate = type === "TEMPLATE" || type === "template";
  return (
    <Badge tone={isTemplate ? "info" : "neutral"} size="xs">
      {isTemplate ? "템플릿" : "일반"}
    </Badge>
  );
}
