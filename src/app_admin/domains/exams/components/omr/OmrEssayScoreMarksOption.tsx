import { Badge, Button } from "@/shared/ui/ds";
import type { useOmrEssayScoreMarks } from "./useOmrEssayScoreMarks";
import styles from "./OmrSheetBuilder.module.css";

export default function OmrEssayScoreMarksOption({ marks }: {
  marks: ReturnType<typeof useOmrEssayScoreMarks>;
}) {
  const enabled = Boolean(marks.grid);
  return (
    <div className={`${styles.optionRow} ${styles.optionRowStacked}`}>
      <div className={styles.optionCopy}>
        <span className={`${styles.optionLabel} ${styles.optionLabelWithBadge}`}>
          서술형 교사 채점란 <Badge tone="info" size="xs" variant="soft">Beta</Badge>
        </span>
        <span className={styles.optionHelp} role={marks.readError ? "alert" : "status"}>{marks.help}</span>
      </div>
      <div className={styles.areaChoices} role="radiogroup" aria-label="서술형 교사 채점란">
        {[true, false].map((value) => (
          <button type="button" role="radio" key={String(value)} aria-checked={enabled === value}
            className={`${styles.areaChoice} ${enabled === value ? styles.areaChoiceActive : ""}`}
            disabled={marks.busy || marks.readError || enabled === value}
            onClick={() => marks.select(value)}>
            {value ? "사용" : "사용 안 함"}
          </button>
        ))}
      </div>
      {marks.grid === "exam" && <details className={styles.optionHelp}>
        <summary>9점 이상 표시하는 법</summary>
        합이 되도록 숫자를 칠하세요(15점 = 7+8). 소수나 {marks.maxScore}점을 넘는 점수는 채점표에 직접 입력하세요.
      </details>}
      {marks.enableScanning && <Button type="button" disabled={marks.busy} onClick={marks.enableScanning}>스캔 점수 제안 켜기</Button>}
      {marks.readError && <Button type="button" onClick={marks.retry}>다시 불러오기</Button>}
      {marks.canPrintOnce && <Button type="button" onClick={marks.printOnce}>이번 답안지에만 인쇄</Button>}
      {marks.clearSaved && <Button type="button" disabled={marks.busy} onClick={marks.clearSaved}>저장된 스캔 설정 끄기</Button>}
    </div>
  );
}
