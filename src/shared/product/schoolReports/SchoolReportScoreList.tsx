import type { SchoolReportScore } from "@/shared/api/contracts/schoolReports";
import styles from "./SchoolReports.module.css";

export default function SchoolReportScoreList({ scores }: { scores: SchoolReportScore[] }) {
  return (
    <dl className={styles.scoreList}>
      {scores.map((score) => (
        <div key={score.id}>
          <dt>{score.subject}</dt>
          <dd>
            <strong>{score.score}</strong>
            <span> / {score.max_score}점</span>
            {score.grade_rank != null && <span> · {score.grade_rank}등급</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
