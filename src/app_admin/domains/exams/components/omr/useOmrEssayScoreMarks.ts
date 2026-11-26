import { useState } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOMREssayScoreMarks, updateOMREssayScoreMarks, type OMRParams } from "@admin/domains/exams/api/omr.api";
import { adminExamsQueryKeys } from "@admin/domains/exams/queryKeys";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

export function useOmrEssayScoreMarks(examId: number | undefined, hasEssays: boolean) {
  const target = examId ?? "tool";
  const [paperChoice, setPaperChoice] = useState<{ target: typeof target; enabled: boolean } | null>(null);
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
      setPaperChoice(current => current?.target === id ? null : current);
      feedback.success(state.enabled
        ? "서술형 교사 채점란을 켰습니다. 새로 인쇄한 답안지부터 적용됩니다."
        : "새로 인쇄하는 답안지에서 교사 채점란을 뺐습니다.");
    },
    onError: (error) => feedback.error(extractApiError(error, "채점란 설정을 바꾸지 못했습니다.")),
  });
  const state = settings.data;
  const paperOverride = paperChoice?.target === target ? paperChoice.enabled : undefined;
  const paper = paperOverride ?? (examId === undefined || Boolean(state?.print_by_default));
  const grid: OMRParams["essay_score_grid"] = !hasEssays ? undefined
    : state?.printed ? "exam" : paper ? "paper" : undefined;
  const busy = save.isPending || (examId !== undefined && settings.isLoading);
  let help = "서술형 문항 옆에 선생님이 칠할 0~8 배점 버블을 인쇄합니다.";
  if (examId !== undefined && settings.isError) {
    help = "시험 채점란 설정을 불러오지 못했습니다.";
  } else if (busy) {
    help = save.isPending ? "채점란 설정을 저장하는 중입니다." : "채점란 설정을 불러오는 중입니다.";
  } else if (grid === "exam") {
    help = "PDF에 0~8점 칸이 들어갑니다. 칠한 점수는 스캔 후 채점표에서 확인하세요.";
  } else if (grid === "paper") {
    help = [state?.reason, "PDF에 수기 채점용 0~8점 칸이 들어갑니다."].filter(Boolean).join(" ");
  }
  return {
    grid, busy, help, maxScore: state?.max_score,
    requestGrid: examId !== undefined && hasEssays && paperOverride === undefined && (!state || settings.isError)
      ? "auto" as const : grid,
    saving: save.isPending,
    readError: examId !== undefined && settings.isError,
    canPrintOnce: save.isError && !state?.printed && !paper,
    enableScanning: grid === "paper" && state?.available && examId !== undefined
      ? () => save.mutate({ id: examId, enabled: true }) : undefined,
    retry: () => { void settings.refetch(); },
    printOnce: () => setPaperChoice({ target, enabled: true }),
    select: (enabled: boolean) => {
      if (examId === undefined || !state?.available || (!state.printed && paperOverride !== undefined)) {
        setPaperChoice({ target, enabled });
      } else {
        save.mutate({ id: examId, enabled });
      }
    },
    clearSaved: examId !== undefined && state?.enabled && !state.available
      ? () => save.mutate({ id: examId, enabled: false }) : undefined,
  };
}
