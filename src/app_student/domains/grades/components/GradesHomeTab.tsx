/**
 * 성적 홈 탭 — 시험 성적 / 과제 현황 내부 토글 + 목록
 * GradesPage에서 추출.
 */
import { useState, useMemo } from "react";
import EmptyState from "@student/layout/EmptyState";
import LectureExamGroup, { type ExamGroup } from "./LectureExamGroup";
import LectureHwGroup, { type HwGroup } from "./LectureHwGroup";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades.api";
import styles from "./GradesHomeTab.module.css";

type SubTab = "exams" | "homework";
type SortMode = "lecture" | "recent";
type ExamReviewFilter = "all" | "pending" | "resolved";
type HomeworkSortMode = "session_desc" | "session_asc" | "recent";
type HomeworkStatusFilter = "all" | "todo" | "done";
type HomeworkSessionScope = "all" | "REGULAR" | "SUPPLEMENT";

const UNGROUPED_KEY = "__ungrouped__";

/* ── Grouping helpers ── */

function groupExams(exams: MyExamGradeSummary[]): ExamGroup[] {
  const map = new Map<string, MyExamGradeSummary[]>();
  for (const e of exams) {
    const key = e.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(e);
    else map.set(key, [e]);
  }
  function calcAvgPct(items: MyExamGradeSummary[]): number {
    const scored = items.filter((e) => e.total_score != null && e.max_score > 0);
    return scored.length > 0
      ? Math.round(scored.reduce((s, e) => s + (e.total_score! / e.max_score) * 100, 0) / scored.length)
      : 0;
  }
  const groups: ExamGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    groups.push({ key, label: key, exams: items, avgPct: calcAvgPct(items) });
  }
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    groups.push({ key: UNGROUPED_KEY, label: "기타 시험", exams: ungrouped, avgPct: calcAvgPct(ungrouped) });
  }
  return groups;
}

function groupHomeworks(homeworks: MyHomeworkGradeSummary[]): HwGroup[] {
  const map = new Map<string, MyHomeworkGradeSummary[]>();
  for (const h of homeworks) {
    const key = h.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(h);
    else map.set(key, [h]);
  }
  const groups: HwGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    const withMax = items.filter((h) => h.score != null && h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score! / h.max_score!) * 100, 0) / withMax.length)
      : null;
    groups.push({ key, label: key, homeworks: items, avgPct });
  }
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    const withMax = ungrouped.filter((h) => h.score != null && h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score! / h.max_score!) * 100, 0) / withMax.length)
      : null;
    groups.push({ key: UNGROUPED_KEY, label: "기타 과제", homeworks: ungrouped, avgPct });
  }
  return groups;
}

function isHomeworkDone(homework: MyHomeworkGradeSummary): boolean {
  return homework.achievement === "PASS"
    || homework.achievement === "REMEDIATED"
    || homework.passed === true;
}

function homeworkSessionOrder(homework: MyHomeworkGradeSummary): number | null {
  const value = homework.session_regular_order ?? homework.session_order;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sortHomeworks(
  homeworks: MyHomeworkGradeSummary[],
  mode: HomeworkSortMode,
): MyHomeworkGradeSummary[] {
  return [...homeworks].sort((a, b) => {
    if (mode === "recent") {
      const recordedDiff = Date.parse(b.recorded_at ?? "") - Date.parse(a.recorded_at ?? "");
      if (Number.isFinite(recordedDiff) && recordedDiff !== 0) return recordedDiff;
    } else {
      const aOrder = homeworkSessionOrder(a);
      const bOrder = homeworkSessionOrder(b);
      if (aOrder == null && bOrder != null) return 1;
      if (aOrder != null && bOrder == null) return -1;
      if (aOrder != null && bOrder != null && aOrder !== bOrder) {
        return mode === "session_desc" ? bOrder - aOrder : aOrder - bOrder;
      }
    }
    const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (displayOrderDiff !== 0) return displayOrderDiff;
    return b.homework_id - a.homework_id;
  });
}

type Props = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
  labels?: { pass?: string; fail?: string };
};

export default function GradesHomeTab({ exams, homeworks, labels }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("exams");
  const [examSort, setExamSort] = useState<SortMode>("lecture");
  const [examReview, setExamReview] = useState<ExamReviewFilter>("all");
  const [homeworkSort, setHomeworkSort] = useState<HomeworkSortMode>("session_desc");
  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatusFilter>("all");
  const [homeworkSessionScope, setHomeworkSessionScope] = useState<HomeworkSessionScope>("all");

  const examReviewCounts = useMemo(() => ({
    pending: exams.filter((exam) => exam.correction_status === "PENDING").length,
    resolved: exams.filter((exam) => (
      exam.correction_status === "COMPLETED"
      || exam.correction_status === "NOT_REQUIRED"
    )).length,
  }), [exams]);
  const visibleExams = useMemo(() => exams.filter((exam) => {
    if (examReview === "pending") return exam.correction_status === "PENDING";
    if (examReview === "resolved") {
      return exam.correction_status === "COMPLETED"
        || exam.correction_status === "NOT_REQUIRED";
    }
    return true;
  }), [examReview, exams]);
  const sortedExams = useMemo(() => {
    if (examSort !== "recent") return visibleExams;
    return [...visibleExams].sort((a, b) => {
      const ta = a.submitted_at ? Date.parse(a.submitted_at) : 0;
      const tb = b.submitted_at ? Date.parse(b.submitted_at) : 0;
      return tb - ta; // 최신순
    });
  }, [examSort, visibleExams]);

  const examGroups = useMemo(() => groupExams(visibleExams), [visibleExams]);
  const visibleHomeworks = useMemo(() => {
    const filtered = homeworks.filter((homework) => {
      if (homeworkSessionScope !== "all" && homework.session_type !== homeworkSessionScope) return false;
      if (homeworkStatus === "done") return isHomeworkDone(homework);
      if (homeworkStatus === "todo") return !isHomeworkDone(homework);
      return true;
    });
    return sortHomeworks(filtered, homeworkSort);
  }, [homeworkSessionScope, homeworkSort, homeworkStatus, homeworks]);
  const hwGroups = useMemo(() => groupHomeworks(visibleHomeworks), [visibleHomeworks]);
  const homeworkDoneCount = useMemo(() => homeworks.filter(isHomeworkDone).length, [homeworks]);

  return (
    <div className={styles.stack}>
      {/* 내부 토글: 시험 성적 / 과제 현황 */}
      <div className={styles.toggleBar}>
        <ToggleBtn active={subTab === "exams"} onClick={() => setSubTab("exams")}
          label={`시험 성적${exams.length > 0 ? ` ${exams.length}` : ""}`} />
        <ToggleBtn active={subTab === "homework"} onClick={() => setSubTab("homework")}
          label={`과제 현황${homeworks.length > 0 ? ` ${homeworks.length}` : ""}`} />
      </div>

      {subTab === "exams" && (
        <div>
          {exams.length === 0 ? (
            <EmptyState title="시험 결과가 아직 없습니다." description="시험 응시 후 채점이 완료되면 여기에 표시됩니다." />
          ) : (
            <>
              <section className={styles.examControls} aria-label="시험 성적 표시 기준">
                <div className={styles.controlRow}>
                  <span className={styles.controlLabel}>오답</span>
                  <div className={styles.filterChips} role="group" aria-label="테스트 오답 확인 필터">
                    <SortChip active={examReview === "all"} onClick={() => setExamReview("all")} label={`전체 ${exams.length}`} />
                    <SortChip active={examReview === "pending"} onClick={() => setExamReview("pending")} label={`확인 필요 ${examReviewCounts.pending}`} />
                    <SortChip active={examReview === "resolved"} onClick={() => setExamReview("resolved")} label={`처리됨 ${examReviewCounts.resolved}`} />
                  </div>
                </div>
                <div className={styles.sortBar} role="group" aria-label="시험 정렬">
                  <SortChip active={examSort === "lecture"} onClick={() => setExamSort("lecture")} label="강좌별" />
                  <SortChip active={examSort === "recent"} onClick={() => setExamSort("recent")} label="최근순" />
                  <span className={styles.visibleCount} aria-live="polite">
                    {visibleExams.length}/{exams.length}건 표시
                  </span>
                </div>
              </section>
              {visibleExams.length === 0 ? (
                <EmptyState title="조건에 맞는 시험이 없습니다." description="오답 확인 필터를 바꿔 다시 확인해 보세요." />
              ) : examSort === "lecture" ? (
                <div data-guide="grades-list" className={styles.gradeList}>
                  {examGroups.map((group) => (
                    <LectureExamGroup key={group.key} group={group} labels={labels} />
                  ))}
                </div>
              ) : (
                <div data-guide="grades-list" className={styles.gradeList}>
                  <LectureExamGroup
                    key="__recent__"
                    group={{ key: "__recent__", label: "최근 응시 순", exams: sortedExams, avgPct: null }}
                    labels={labels}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab === "homework" && (
        <div>
          {homeworks.length === 0 ? (
            <EmptyState title="과제 성적이 아직 없습니다." description="과제 점수가 입력되면 여기에 표시됩니다." />
          ) : (
            <>
              <section className={styles.homeworkControls} aria-label="과제 표시 기준">
                <div className={styles.controlRow}>
                  <span className={styles.controlLabel}>상태</span>
                  <div className={styles.filterChips} role="group" aria-label="과제 상태 필터">
                    <SortChip active={homeworkStatus === "all"} onClick={() => setHomeworkStatus("all")} label={`전체 ${homeworks.length}`} />
                    <SortChip active={homeworkStatus === "todo"} onClick={() => setHomeworkStatus("todo")} label={`확인 필요 ${homeworks.length - homeworkDoneCount}`} />
                    <SortChip active={homeworkStatus === "done"} onClick={() => setHomeworkStatus("done")} label={`완료 ${homeworkDoneCount}`} />
                  </div>
                </div>
                <div className={styles.controlRow}>
                  <label className={styles.selectLabel}>
                    <span>수업</span>
                    <select
                      value={homeworkSessionScope}
                      onChange={(event) => setHomeworkSessionScope(event.target.value as HomeworkSessionScope)}
                      aria-label="과제 수업 범위"
                    >
                      <option value="all">정규·보강 전체</option>
                      <option value="REGULAR">정규 수업</option>
                      <option value="SUPPLEMENT">보강</option>
                    </select>
                  </label>
                  <label className={styles.selectLabel}>
                    <span>정렬</span>
                    <select
                      value={homeworkSort}
                      onChange={(event) => setHomeworkSort(event.target.value as HomeworkSortMode)}
                      aria-label="과제 정렬"
                    >
                      <option value="session_desc">최근 차시순</option>
                      <option value="session_asc">1차시부터</option>
                      <option value="recent">최근 기록순</option>
                    </select>
                  </label>
                  <span className={styles.visibleCount} aria-live="polite">
                    {visibleHomeworks.length}/{homeworks.length}건 표시
                  </span>
                </div>
              </section>
              {visibleHomeworks.length === 0 ? (
                <EmptyState title="조건에 맞는 과제가 없습니다." description="상태나 수업 필터를 바꿔 다시 확인해 보세요." />
              ) : (
                <div className={styles.gradeList}>
                  {hwGroups.map((group) => (
                    <LectureHwGroup key={group.key} group={group} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SortChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.sortChip}
      data-active={active}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.toggleButton}
      data-active={active}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
