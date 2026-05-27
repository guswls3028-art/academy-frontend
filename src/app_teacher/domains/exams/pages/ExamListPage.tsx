// PATH: src/app_teacher/domains/exams/pages/ExamListPage.tsx
// 시험/과제 목록 — 차시에 살아있는 운영 시험/과제만 조회한다.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchExams, fetchHomeworks } from "../api";

import styles from "./ExamListPage.module.css";

type Tab = "exam" | "homework";
type SortableItem = { created_at?: string };

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function ExamListPage() {
  const [tab, setTab] = useState<Tab>("exam");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          시험 / 과제
        </h2>
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
    </div>
  );
}

function sortByCreated<T extends SortableItem>(items: readonly T[] | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => {
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}

function ExamTab() {
  const navigate = useNavigate();
  const { data: exams, isLoading } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: () => fetchExams({ exam_type: "regular" }),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    return sortByCreated((exams ?? []) as Array<{
      id: number;
      title: string;
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
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => navigate(`/teacher/exams/${e.id}`)}
            className={styles.itemCard}
          >
            <div className={styles.examCardHeader}>
              <div className={styles.itemTitleRow}>
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
    queryFn: () => fetchHomeworks({ homework_type: "regular" }),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    return sortByCreated((hws ?? []) as Array<{
      id: number;
      title: string;
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
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => navigate(`/teacher/homeworks/${h.id}`)}
            className={styles.itemCard}
          >
            <div className={styles.itemTitleRow}>
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
