import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  fetchOMREssayScoreMarks,
  updateOMREssayScoreMarks,
} from "@admin/domains/exams/api/omr.api";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";

import styles from "./OmrSheetBuilder.module.css";

type Props = {
  examId: number;
  /** 설정이 바뀌면 미리보기를 다시 그린다. */
  onChanged: () => void;
};

/**
 * Beta: 서술형 교사 채점란. 교사가 서술형 칸 옆에 점수를 칠하면 스캔 후 채점표에
 * 점수가 제안된다. 교사가 채점표에서 확인하고 확정한다.
 * 계약: docs/GRADING-WRONG-NOTE-WORKFLOW.md "OMR 교사 채점란 (Beta)".
 */
export default function OmrEssayScoreMarksOption({ examId, onChanged }: Props) {
  const queryClient = useQueryClient();
  const queryKey = adminExamsQueryKeys.omrEssayScoreMarks(examId);
  const stateQuery = useQuery({
    queryKey,
    queryFn: () => fetchOMREssayScoreMarks(examId),
  });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => updateOMREssayScoreMarks(examId, enabled),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
      feedback.success(
        state.enabled
          ? "서술형 교사 채점란을 켰습니다. 새로 인쇄한 답안지부터 적용됩니다."
          : "새로 인쇄하는 답안지에서 교사 채점란을 뺐습니다.",
      );
      onChanged();
    },
    onError: (error) =>
      feedback.error(extractApiError(error, "채점란 설정을 바꾸지 못했습니다.")),
  });

  const state = stateQuery.data;
  const enabled = Boolean(state?.enabled);
  const canEnable = Boolean(state?.available);
  const busy = mutation.isPending || stateQuery.isLoading;

  let help: string;
  if (stateQuery.isError) {
    help = "설정을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.";
  } else if (!state) {
    help = "설정을 불러오는 중입니다.";
  } else if (state.enabled && !state.printed) {
    help = `${state.reason || "현재 문항 구성에는 채점란을 넣을 수 없습니다."} 지금은 채점란 없이 인쇄됩니다.`;
  } else if (!state.available && !state.enabled) {
    help = state.reason;
  } else {
    help = enabled
      ? `0~8점은 해당 숫자 하나를, 9점 이상은 합이 되는 숫자들을 칠하세요(15점 = 7+8). 스캔한 뒤 문항별 점수 입력에서 확인하고 확정하세요. 소수나 ${state.max_score}점을 넘는 점수는 채점표에 직접 입력하세요.`
      : "서술형 문항 옆에 선생님이 칠할 0~8 배점 버블을 인쇄합니다.";
  }

  return (
    <div className={`${styles.optionRow} ${styles.optionRowStacked}`}>
      <div className={styles.optionCopy}>
        <span className={`${styles.optionLabel} ${styles.optionLabelWithBadge}`}>
          서술형 교사 채점란 <Badge tone="info" size="xs" variant="soft">Beta</Badge>
        </span>
        <span className={styles.optionHelp} role={stateQuery.isError ? "alert" : undefined}>
          {help}
        </span>
      </div>
      <div className={styles.areaChoices} role="radiogroup" aria-label="서술형 교사 채점란">
        <button
          type="button"
          role="radio"
          aria-checked={enabled}
          className={`${styles.areaChoice} ${enabled ? styles.areaChoiceActive : ""}`}
          disabled={busy || enabled || !canEnable}
          title={!canEnable && state ? state.reason : undefined}
          onClick={() => mutation.mutate(true)}
        >
          사용
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!enabled}
          className={`${styles.areaChoice} ${!enabled ? styles.areaChoiceActive : ""}`}
          disabled={busy || !enabled}
          onClick={() => mutation.mutate(false)}
        >
          사용 안 함
        </button>
      </div>
    </div>
  );
}
