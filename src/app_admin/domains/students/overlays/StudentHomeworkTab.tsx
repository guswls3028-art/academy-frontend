import { useState } from "react";

import type { StudentHomeworkGrade } from "@/shared/api/contracts/studentGrades";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { Badge, Button, EmptyState, type BadgeTone } from "@/shared/ui/ds";

import HomeworkQuickEditor from "./HomeworkQuickEditor";
import homeworkStyles from "./StudentHomeworkTab.module.css";
import styles from "./StudentsDetailOverlay.module.css";

type SessionScope = "all" | "REGULAR" | "SUPPLEMENT";
type StatusScope = "all" | "attention" | "done";
type SortMode = "session_desc" | "session_asc" | "updated";

type Props = {
  data: StudentHomeworkGrade[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onUpdated: () => Promise<unknown>;
  onNavigate: (path: string) => void;
};

const ACHIEVEMENT_LABEL: Record<string, string> = {
  PASS: "완료",
  FAIL: "미완료",
  REMEDIATED: "보강완료",
  NOT_SUBMITTED: "미제출",
};

const ACHIEVEMENT_TONE: Record<string, BadgeTone> = {
  PASS: "success",
  FAIL: "danger",
  REMEDIATED: "warning",
  NOT_SUBMITTED: "danger",
};

function isDone(homework: StudentHomeworkGrade) {
  return homework.achievement === "PASS"
    || homework.achievement === "REMEDIATED"
    || homework.passed === true;
}

function ChevronIcon() {
  return (
    <svg
      className={styles.chevronIcon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function StudentHomeworkTab({
  data,
  isLoading,
  isError,
  onRetry,
  onUpdated,
  onNavigate,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [sessionScope, setSessionScope] = useState<SessionScope>("all");
  const [statusScope, setStatusScope] = useState<StatusScope>("all");
  const [sortMode, setSortMode] = useState<SortMode>("session_desc");

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="과제 성적을 불러오는 중…" />;
  if (isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="과제 성적을 불러오지 못했습니다."
        description="잠시 후 다시 불러와 주세요."
        actions={<Button size="sm" onClick={onRetry}>다시 불러오기</Button>}
      />
    );
  }
  if (!data.length) return <EmptyState scope="panel" tone="empty" title="과제 성적이 없습니다." />;

  const visibleData = data
    .filter((homework) => {
      if (sessionScope !== "all" && homework.session_type !== sessionScope) return false;
      if (statusScope === "done") return isDone(homework);
      if (statusScope === "attention") return !isDone(homework);
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "updated") {
        const updatedDiff = Date.parse(b.score_updated_at ?? "") - Date.parse(a.score_updated_at ?? "");
        if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
      } else {
        const aOrder = a.session_regular_order ?? a.session_order;
        const bOrder = b.session_regular_order ?? b.session_order;
        if (aOrder == null && bOrder != null) return 1;
        if (aOrder != null && bOrder == null) return -1;
        if (aOrder != null && bOrder != null && aOrder !== bOrder) {
          return sortMode === "session_desc" ? bOrder - aOrder : aOrder - bOrder;
        }
      }
      const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (displayOrderDiff !== 0) return displayOrderDiff;
      return b.homework_id - a.homework_id;
    });

  return (
    <div>
      <section className={homeworkStyles.controls} aria-label="과제 이력 표시 기준">
        <div className={homeworkStyles.summary}>
          <strong>차시별 과제</strong>
          <span aria-live="polite">{visibleData.length}/{data.length}건 표시</span>
        </div>
        <div className={homeworkStyles.filters}>
          <label>
            <span>수업</span>
            <select value={sessionScope} onChange={(event) => setSessionScope(event.target.value as SessionScope)}>
              <option value="all">정규·보강 전체</option>
              <option value="REGULAR">정규 수업</option>
              <option value="SUPPLEMENT">보강</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={statusScope} onChange={(event) => setStatusScope(event.target.value as StatusScope)}>
              <option value="all">전체 상태</option>
              <option value="attention">확인 필요</option>
              <option value="done">완료</option>
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="session_desc">최근 차시순</option>
              <option value="session_asc">1차시부터</option>
              <option value="updated">최근 수정순</option>
            </select>
          </label>
        </div>
      </section>
      {visibleData.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="조건에 맞는 과제가 없습니다." description="수업 또는 상태 필터를 바꿔 주세요." />
      ) : (
        <div className={styles.tabList}>
          {visibleData.map((homework, index) => {
            const canNavigate = Boolean(homework.lecture_id && homework.session_id);
            const navigationPath = canNavigate
              ? `/workspace/lectures/${homework.lecture_id}/sessions/${homework.session_id}/scores`
              : "";
            const rowKey = `${homework.homework_id}-${homework.enrollment_id}-${index}`;
            const isEditing = editingKey === rowKey;
            return (
              <div key={rowKey} className={styles.homeworkRecordGroup}>
                <div
                  className={styles.tabRecord}
                  data-clickable={canNavigate ? "" : undefined}
                  onClick={canNavigate ? () => onNavigate(navigationPath) : undefined}
                >
                  {homework.lecture_title && (
                    <LectureChip
                      lectureName={homework.lecture_title}
                      color={homework.lecture_color ?? undefined}
                      chipLabel={homework.lecture_chip_label}
                      size={24}
                    />
                  )}
                  <div className={styles.recordMain}>
                    <span className={styles.recordTitle}>{homework.title}</span>
                    <div className={styles.recordMetaRow}>
                      {homework.session_title && <span>{homework.session_title}</span>}
                      {homework.session_type && <span>· {homework.session_type === "SUPPLEMENT" ? "보강" : "정규"}</span>}
                      <span>· {homework.grading_mode === "COMPLETION" ? "완료 체크" : "숫자 채점"}</span>
                      {(homework.retake_count ?? 0) > 1 && <span>· 재시도 {(homework.retake_count ?? 0) - 1}회</span>}
                    </div>
                  </div>
                  <div className={styles.recordActions}>
                    {homework.grading_mode !== "COMPLETION" && homework.score != null && (
                      <span className={styles.scoreValue}>
                        {Math.round(homework.score)}<span className={styles.scoreMax}>/{homework.max_score ?? 100}</span>
                      </span>
                    )}
                    <Badge
                      variant="solid"
                      size="sm"
                      tone={homework.achievement ? (ACHIEVEMENT_TONE[homework.achievement] || "muted") : "muted"}
                    >
                      {homework.achievement ? (ACHIEVEMENT_LABEL[homework.achievement] || homework.achievement) : "검사 전"}
                    </Badge>
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      aria-expanded={isEditing}
                      aria-controls={`homework-quick-editor-${homework.homework_id}-${homework.enrollment_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingKey(isEditing ? null : rowKey);
                      }}
                    >
                      바로 수정
                    </Button>
                    {canNavigate && <ChevronIcon />}
                  </div>
                </div>
                {isEditing && (
                  <HomeworkQuickEditor
                    grade={homework}
                    onClose={() => setEditingKey(null)}
                    onUpdated={onUpdated}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
