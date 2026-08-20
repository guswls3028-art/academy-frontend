// PATH: src/app_teacher/domains/exams/pages/ExamListPage.tsx
// 시험/과제 목록 — 차시에 살아있는 운영 시험/과제만 조회한다.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { cx } from "@/shared/utils/cx";
import { Badge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchExams, fetchHomeworks } from "../api";
import { teacherExamsQueryKeys } from "../queryKeys";

import styles from "./ExamListPage.module.css";

type Tab = "exam" | "homework";
type SortableItem = { created_at?: string };

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
  const examsQ = useQuery({
    queryKey: teacherExamsQueryKeys.exams,
    queryFn: () => fetchExams({ exam_type: "regular" }),
    staleTime: 60_000,
  });
  const exams = examsQ.data;

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

  if (examsQ.isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (examsQ.isError) return <QueryFailure title="시험 목록을 불러오지 못했습니다" onRetry={() => void examsQ.refetch()} />;
  if (!sorted.length)
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="등록된 시험이 없습니다"
        description="시험은 강의의 차시에 추가하면 목록과 성적 화면으로 연결됩니다."
        actions={
          <EmptyActionButton onClick={() => navigate("/workspace/mobile/classes")}>
            강의에서 추가
          </EmptyActionButton>
        }
      />
    );

  return (
    <div className={styles.list}>
      {sorted.map((e) => {
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => navigate(`/workspace/mobile/exams/${e.id}`)}
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
  const homeworksQ = useQuery({
    queryKey: teacherExamsQueryKeys.homeworks,
    queryFn: () => fetchHomeworks({ homework_type: "regular" }),
    staleTime: 60_000,
  });
  const hws = homeworksQ.data;

  const sorted = useMemo(() => {
    return sortByCreated((hws ?? []) as Array<{
      id: number;
      title: string;
      due_date?: string;
      created_at?: string;
    }>);
  }, [hws]);

  if (homeworksQ.isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (homeworksQ.isError) return <QueryFailure title="과제 목록을 불러오지 못했습니다" onRetry={() => void homeworksQ.refetch()} />;
  if (!sorted.length)
    return (
      <EmptyState
        scope="panel"
        tone="empty"
        title="등록된 과제가 없습니다"
        description="과제는 강의의 차시에 추가하면 제출 현황과 미제출 안내로 이어집니다."
        actions={
          <EmptyActionButton onClick={() => navigate("/workspace/mobile/classes")}>
            강의에서 추가
          </EmptyActionButton>
        }
      />
    );

  return (
    <div className={styles.list}>
      {sorted.map((h) => {
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => navigate(`/workspace/mobile/homeworks/${h.id}`)}
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

function QueryFailure({ title, onRetry }: { title: string; onRetry: () => void }) {
  return <EmptyState scope="panel" tone="error" title={title} description="빈 목록으로 표시하지 않고 조회를 중단했습니다." actions={<EmptyActionButton onClick={onRetry}>다시 시도</EmptyActionButton>} />;
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
