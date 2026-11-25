import { useState } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOMREssayScoreMarks, updateOMREssayScoreMarks, type OMRParams } from "@admin/domains/exams/api/omr.api";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

export function useOmrEssayScoreMarks(examId: number | undefined, hasEssays: boolean) {
  const target = examId ?? "tool";
  const [paperTarget, setPaperTarget] = useState<typeof target | null>(null);
  const queryClient = useQueryClient();
  const queryKey = adminExamsQueryKeys.omrEssayScoreMarks(examId ?? 0);
  const settings = useQuery({
    queryKey,
    queryFn: examId !== undefined && hasEssays ? () => fetchOMREssayScoreMarks(examId) : skipToken,
  });
  const save = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => updateOMREssayScoreMarks(id, enabled),
    onSuccess: (state, { id }) => {
      queryClient.setQueryData(adminExamsQueryKeys.omrEssayScoreMarks(id), state);
      setPaperTarget(current => current === id ? null : current);
      feedback.success(state.enabled
        ? "서술형 교사 채점란을 켰습니다. 새로 인쇄한 답안지부터 적용됩니다."
        : "새로 인쇄하는 답안지에서 교사 채점란을 뺐습니다.");
    },
    onError: (error) => feedback.error(extractApiError(error, "채점란 설정을 바꾸지 못했습니다.")),
  });
  const state = settings.data;
  const paper = paperTarget === target;
  const grid: OMRParams["essay_score_grid"] = !hasEssays ? undefined : paper ? "paper" : state?.printed ? "exam" : undefined;
  const busy = save.isPending || (examId !== undefined && settings.isLoading);
  let help = "서술형 문항 옆에 선생님이 칠할 0~8 배점 버블을 인쇄합니다.";
  if (examId !== undefined && settings.isError) {
    help = "시험 채점란 설정을 불러오지 못했습니다.";
  } else if (busy) {
    help = save.isPending ? "채점란 설정을 저장하는 중입니다." : "채점란 설정을 불러오는 중입니다.";
  } else if (paper || examId === undefined || !state?.available) {
    help = [state?.reason, "이번 답안지에 0~8 배점 버블을 인쇄합니다. 점수는 수기로 기록하세요."].filter(Boolean).join(" ");
  } else if (state.printed) {
    help = `0~8점은 해당 숫자 하나를, 9점 이상은 합이 되는 숫자들을 칠하세요(15점 = 7+8). 스캔한 뒤 문항별 점수 입력에서 OMR 제안을 확인하고 확정하세요. 소수나 ${state.max_score}점을 넘는 점수는 채점표에 직접 입력하세요.`;
  }
  return {
    grid, busy, help,
    readError: examId !== undefined && settings.isError,
    canPrintOnce: save.isError && !state?.printed && !paper,
    retry: () => { void settings.refetch(); },
    printOnce: () => setPaperTarget(target),
    select: (enabled: boolean) => {
      if (examId === undefined || paper || !state?.available) setPaperTarget(enabled ? target : null);
      else save.mutate({ id: examId, enabled });
    },
    clearSaved: examId !== undefined && state?.enabled && !state.available
      ? () => save.mutate({ id: examId, enabled: false }) : undefined,
  };
}
