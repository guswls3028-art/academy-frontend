/**
 * 강좌별 과제 성적 그룹 — GradesPage에서 추출
 */
import { IconClipboard } from "@student/shared/ui/icons/Icons";
import GradeBadge from "./GradeBadge";
import type { MyHomeworkGradeSummary } from "../api/grades.api";
import styles from "./LectureGradeGroup.module.css";

export type HwGroup = {
  key: string;
  label: string;
  homeworks: MyHomeworkGradeSummary[];
  avgPct: number | null;
};

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export default function LectureHwGroup({ group }: { group: HwGroup }) {
  return (
    <div>
      <div className={styles.groupHeader}>
        <div className={styles.groupTitleBlock}>
          <div className={styles.groupTitle}>{group.label}</div>
          <div className={`stu-muted ${styles.groupMeta}`}>
            {group.homeworks.length}건{group.avgPct != null ? ` · 평균 ${group.avgPct}점` : ""}
          </div>
        </div>
      </div>
      <div className={styles.list}>
        {group.homeworks.map((h, idx) => {
          const gradingMode = h.grading_mode ?? "SCORE";
          const score = typeof h.score === "number" && Number.isFinite(h.score) ? h.score : null;
          const maxScore = typeof h.max_score === "number" && Number.isFinite(h.max_score) && h.max_score > 0
            ? h.max_score
            : null;
          const scoreText = gradingMode === "COMPLETION"
            ? score == null ? "검사 전" : score > 0 ? "완료" : "미완료"
            : score == null
              ? maxScore == null ? "검사 전" : `–/${formatScore(maxScore)}`
              : maxScore == null ? formatScore(score) : `${formatScore(score)}/${formatScore(maxScore)}`;
          const badgePassed = h.achievement == null && score == null ? null : h.passed;
          return (
            <div
              key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
              className={`stu-panel stu-panel--accent ${styles.homeworkCard}`}
              data-session-type={h.session_type ?? "UNCLASSIFIED"}
              data-session-order={h.session_order ?? ""}
            >
              <div className={styles.row}>
                <div className={styles.iconWrap}>
                  <IconClipboard className={styles.itemIcon} />
                </div>
                <div className={styles.content}>
                  <div className={styles.title}>{h.title}</div>
                  <div className={`stu-muted ${styles.meta}`}>
                    {h.session_title ?? "차시 미지정"}
                    <span aria-hidden> · </span>
                    {gradingMode === "COMPLETION" ? "완료 체크" : "숫자 채점"}
                  </div>
                </div>
                <div className={styles.homeworkStatus}>
                  <strong className={styles.homeworkScore}>{scoreText}</strong>
                  <GradeBadge
                    passed={badgePassed}
                    achievement={h.achievement}
                    label={{ pass: "완료", fail: "미완료" }}
                    showNotSubmitted
                    notSubmittedLabel="미제출"
                    emptyLabel="검사 전"
                    remediatedLabel="보강 완료"
                    size="sm"
                  />
                </div>
              </div>
              {gradingMode === "SCORE" && maxScore != null && (
                <progress
                  className={styles.homeworkProgress}
                  value={Math.min(Math.max(score ?? 0, 0), maxScore)}
                  max={maxScore}
                  aria-label={`${h.title} 진행 ${score == null ? "검사 전" : `${formatScore(score)}/${formatScore(maxScore)}`}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
