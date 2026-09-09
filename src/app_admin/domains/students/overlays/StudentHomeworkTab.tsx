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
type PeriodScope = "all" | "30" | "90";

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KOREAN_COLLATOR = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });

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

function isoDateToDay(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(utc / DAY_MS);
}

function currentKstDay(now = Date.now()): number {
  const shifted = new Date(now + KST_OFFSET_MS);
  return Math.floor(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) / DAY_MS);
}

function sessionDateLabel(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match || isoDateToDay(value) == null) return "날짜 미확인";
  return `${Number(match[1])}. ${Number(match[2])}. ${Number(match[3])}.`;
}

function compareSessionHistory(a: StudentHomeworkGrade, b: StudentHomeworkGrade, direction: "asc" | "desc") {
  const aDay = isoDateToDay(a.session_date);
  const bDay = isoDateToDay(b.session_date);
  if (aDay == null && bDay != null) return 1;
  if (aDay != null && bDay == null) return -1;
  if (aDay != null && bDay != null && aDay !== bDay) {
    return direction === "desc" ? bDay - aDay : aDay - bDay;
  }

  const aOrder = a.session_regular_order ?? a.session_order;
  const bOrder = b.session_regular_order ?? b.session_order;
  if (aOrder == null && bOrder != null) return 1;
  if (aOrder != null && bOrder == null) return -1;
  if (aOrder != null && bOrder != null && aOrder !== bOrder) {
    return direction === "desc" ? bOrder - aOrder : aOrder - bOrder;
  }

  const lectureDiff = KOREAN_COLLATOR.compare(a.lecture_title ?? "", b.lecture_title ?? "");
  if (lectureDiff !== 0) return lectureDiff;
  const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
  if (displayOrderDiff !== 0) return displayOrderDiff;
  if (a.homework_id !== b.homework_id) return b.homework_id - a.homework_id;
  return a.enrollment_id - b.enrollment_id;
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
  const [periodScope, setPeriodScope] = useState<PeriodScope>("all");
  const [lectureScope, setLectureScope] = useState("all");

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

  const lectureOptions = Array.from(data.reduce((options, homework) => {
    if (homework.lecture_id == null) return options;
    const key = String(homework.lecture_id);
    const day = isoDateToDay(homework.session_date);
    const current = options.get(key);
    if (!current || (day != null && (current.latestDay == null || day > current.latestDay))) {
      options.set(key, {
        id: key,
        title: homework.lecture_title?.trim() || "이름 없는 강의",
        latestDay: day,
        latestDate: day != null ? homework.session_date ?? null : current?.latestDate ?? null,
        chipLabel: homework.lecture_chip_label?.trim() || current?.chipLabel || null,
      });
    }
    return options;
  }, new Map<string, {
    id: string;
    title: string;
    latestDay: number | null;
    latestDate: string | null;
    chipLabel: string | null;
  }>()).values())
    .sort((a, b) => {
      if (a.latestDay == null && b.latestDay != null) return 1;
      if (a.latestDay != null && b.latestDay == null) return -1;
      if (a.latestDay !== b.latestDay) return (b.latestDay ?? 0) - (a.latestDay ?? 0);
      const titleDiff = KOREAN_COLLATOR.compare(a.title, b.title);
      if (titleDiff !== 0) return titleDiff;
      return Number(a.id) - Number(b.id);
    });
  const duplicateLectureTitles = new Set(
    lectureOptions
      .filter((option, index, options) => options.some((candidate, candidateIndex) => (
        candidateIndex !== index && candidate.title === option.title
      )))
      .map((option) => option.title),
  );
  const lectureBaseLabels = lectureOptions.map((option) => ({
    id: option.id,
    chipLabel: option.chipLabel,
    label: duplicateLectureTitles.has(option.title) && option.latestDate
      ? `${option.title} · ${sessionDateLabel(option.latestDate)}`
      : option.title,
  }));
  const lectureBaseLabelCounts = lectureBaseLabels.reduce((counts, option) => {
    counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const lectureLabelCandidates = lectureBaseLabels.map((option) => ({
    id: option.id,
    label: (lectureBaseLabelCounts.get(option.label) ?? 0) > 1 && option.chipLabel
      ? `${option.label} · ${option.chipLabel}`
      : option.label,
  }));
  const lectureLabelCounts = lectureLabelCandidates.reduce((counts, option) => {
    counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const lectureLabels = new Map(lectureLabelCandidates.map((option) => [
    option.id,
    (lectureLabelCounts.get(option.label) ?? 0) > 1
      ? `${option.label} · 강의 #${option.id}`
      : option.label,
  ]));
  const periodDays = periodScope === "all" ? null : Number(periodScope);
  const todayDay = currentKstDay();
  const periodStartDay = periodDays == null ? null : todayDay - periodDays + 1;

  const visibleData = data
    .filter((homework) => {
      if (lectureScope !== "all" && String(homework.lecture_id) !== lectureScope) return false;
      if (periodStartDay != null) {
        const sessionDay = isoDateToDay(homework.session_date);
        if (sessionDay == null || sessionDay < periodStartDay || sessionDay > todayDay) return false;
      }
      if (sessionScope !== "all" && homework.session_type !== sessionScope) return false;
      if (statusScope === "done") return isDone(homework);
      if (statusScope === "attention") return !isDone(homework);
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "updated") {
        const updatedDiff = Date.parse(b.score_updated_at ?? "") - Date.parse(a.score_updated_at ?? "");
        if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
        return compareSessionHistory(a, b, "desc");
      }
      return compareSessionHistory(a, b, sortMode === "session_desc" ? "desc" : "asc");
    });

  return (
    <div>
      <section className={homeworkStyles.controls} aria-label="과제 이력 표시 기준">
        <div className={homeworkStyles.summary}>
          <strong>차시별 과제</strong>
          <span aria-live="polite">{visibleData.length}/{data.length}건 표시</span>
        </div>
        <div className={homeworkStyles.filters}>
          <div className={homeworkStyles.filterRow}>
            <label>
              <span>기간</span>
              <select value={periodScope} onChange={(event) => setPeriodScope(event.target.value as PeriodScope)}>
                <option value="all">전체 기간</option>
                <option value="30">최근 30일</option>
                <option value="90">최근 90일</option>
              </select>
            </label>
            <label className={homeworkStyles.lectureFilter}>
              <span>강의</span>
              <select value={lectureScope} onChange={(event) => setLectureScope(event.target.value)}>
                <option value="all">전체 강의</option>
                {lectureOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {lectureLabels.get(option.id)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={homeworkStyles.filterRow}>
            <label>
              <span>수업</span>
              <select value={sessionScope} onChange={(event) => setSessionScope(event.target.value as SessionScope)}>
                <option value="all">전체 수업</option>
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
                <option value="session_desc">최신 수업일</option>
                <option value="session_asc">오래된 수업일</option>
                <option value="updated">최근 수정</option>
              </select>
            </label>
          </div>
        </div>
      </section>
      {visibleData.length === 0 ? (
        <EmptyState scope="panel" tone="empty" title="조건에 맞는 과제가 없습니다." description="기간·강의 또는 세부 필터를 바꿔 주세요." />
      ) : (
        <div className={styles.tabList}>
          {visibleData.map((homework) => {
            const canNavigate = Boolean(homework.lecture_id && homework.session_id);
            const navigationPath = canNavigate
              ? `/workspace/lectures/${homework.lecture_id}/sessions/${homework.session_id}/scores`
              : "";
            const rowKey = `${homework.homework_id}-${homework.enrollment_id}`;
            const isEditing = editingKey === rowKey;
            return (
              <div key={rowKey} className={styles.homeworkRecordGroup}>
                <div
                  className={styles.tabRecord}
                  data-clickable={canNavigate ? "" : undefined}
                  data-session-date={homework.session_date ?? ""}
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
                      <span>{sessionDateLabel(homework.session_date)}</span>
                      {homework.session_title && <span>· {homework.session_title}</span>}
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
