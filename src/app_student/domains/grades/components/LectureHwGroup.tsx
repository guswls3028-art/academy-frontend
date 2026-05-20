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

export default function LectureHwGroup({ group, labels }: { group: HwGroup; labels?: { pass?: string; fail?: string } }) {
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
        {group.homeworks.map((h, idx) => (
          <div
            key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
            className="stu-panel stu-panel--accent"
          >
            <div className={styles.row}>
              <div className={styles.iconWrap}>
                <IconClipboard className={styles.itemIcon} />
              </div>
              <div className={styles.content}>
                <div className={styles.title}>{h.title}</div>
                <div className={`stu-muted ${styles.meta}`}>
                  {h.session_title && `${h.session_title} · `}
                  {h.max_score != null && h.max_score > 0
                    ? `${h.score}/${h.max_score}점`
                    : `${h.score}점`}
                </div>
              </div>
              <GradeBadge passed={h.passed} achievement={h.achievement} label={labels} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
