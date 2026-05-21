// PATH: src/app_teacher/domains/exams/pages/ExamListPage.tsx
// 시험/과제 목록 — 상태(진행/마감/설정중) 뱃지 + 활성 우선 정렬 + 카드 톤 통일.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { Plus } from "@teacher/shared/ui/Icons";
import { Badge, type BadgeTone } from "@teacher/shared/ui/Badge";
import { fetchExams, fetchHomeworks } from "../api";
import ExamFormSheet from "../components/ExamFormSheet";

import styles from "./ExamListPage.module.css";

type Tab = "exam" | "homework";
type ItemStatus = "DRAFT" | "OPEN" | "CLOSED";
type SortableItem = { status?: ItemStatus; created_at?: string };

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function ExamListPage() {
  const [tab, setTab] = useState<Tab>("exam");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          시험
        </h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={styles.createButton}
        >
          <Plus size={ICON.xs} /> {tab === "exam" ? "시험" : "과제"} 추가
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="시험 및 과제">
        {(["exam", "homework"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(styles.tabButton, tab === t && styles.tabButtonActive)}
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
function statusBadge(status?: ItemStatus): { label: string; tone: BadgeTone } {
  if (status === "OPEN") return { label: "진행", tone: "success" };
  if (status === "DRAFT") return { label: "설정 중", tone: "warning" };
  return { label: "마감", tone: "neutral" };
}

function statusOrder(status?: ItemStatus): number {
  if (status === "OPEN") return 0;
  if (status === "DRAFT") return 1;
  return 2;
}

function sortByStatusAndCreated<T extends SortableItem>(items: readonly T[] | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}

function ExamTab() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: () => fetchExams(),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    return sortByStatusAndCreated((exams ?? []) as Array<{
      id: number;
      title: string;
      status?: ItemStatus;
      exam_type?: string;
      max_score?: number;
      subject?: string;
      created_at?: string;
    }>);
  }, [exams]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!sorted.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 시험이 없습니다" />;

  return (
    <div className={styles.list}>
      {sorted.map((e) => {
        const sb = statusBadge(e.status);
        const isClosed = e.status === "CLOSED";
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => navigate(`/teacher/exams/${e.id}`)}
            className={cx(styles.itemCard, isClosed && styles.itemCardClosed)}
          >
            <div className={styles.examCardHeader}>
              <div className={styles.itemTitleRow}>
                <Badge tone={sb.tone} size="sm">{sb.label}</Badge>
                <span className={styles.itemTitle}>
                  {e.title}
                </span>
              </div>
              <ExamTypeBadge type={e.exam_type} />
            </div>
            <div className={styles.metaRow}>
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
    return sortByStatusAndCreated((hws ?? []) as Array<{
      id: number;
      title: string;
      status?: ItemStatus;
      due_date?: string;
      created_at?: string;
    }>);
  }, [hws]);

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!sorted.length)
    return <EmptyState scope="panel" tone="empty" title="등록된 과제가 없습니다" />;

  return (
    <div className={styles.list}>
      {sorted.map((h) => {
        const sb = statusBadge(h.status);
        const isClosed = h.status === "CLOSED";
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => navigate(`/teacher/homeworks/${h.id}`)}
            className={cx(styles.itemCard, isClosed && styles.itemCardClosed)}
          >
            <div className={styles.itemTitleRow}>
              <Badge tone={sb.tone} size="sm">{sb.label}</Badge>
              <span className={styles.itemTitle}>
                {h.title}
              </span>
            </div>
            {h.due_date && (
              <div className={styles.metaRow}>
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
