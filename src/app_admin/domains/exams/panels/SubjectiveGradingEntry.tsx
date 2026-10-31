import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import { isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { fetchManualGradeSheet } from "@admin/domains/results/api/manualExamGrading";
import { adminResultsQueryKeys } from "@admin/domains/results/queryKeys";
import { updateAdminExam } from "../api/adminExam";
import { adminExamsQueryKeys } from "../queryKeys";
import type { Exam } from "../types";
import styles from "./ExamResultsViewerPanel.module.css";

export default function SubjectiveGradingEntry({ exam, onEnter, onStatistics, onOpenSetup }: {
  exam: Exam;
  onEnter: () => void;
  onStatistics: () => void;
  onOpenSetup?: () => void;
}) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (focusFrameRef.current != null) window.cancelAnimationFrame(focusFrameRef.current);
    };
  }, []);
  const needsSetup = exam.grading_mode === "choice";
  const usesCorrectness = !needsSetup && exam.manual_grading_method === "correctness";
  const sheet = useQuery({
    queryKey: adminResultsQueryKeys.manualGradeSheet(exam.id),
    queryFn: () => fetchManualGradeSheet(exam.id),
    enabled: needsSetup,
  });
  const choices = sheet.data?.questions.filter((question) => question.kind === "choice").length ?? 0;
  const essays = sheet.data?.questions.filter((question) => question.kind === "essay").length ?? 0;
  const enableGrading = useMutation({
    mutationFn: () => updateAdminExam(exam.id, {
      grading_mode: choices > 0 ? "mixed" : "written",
      manual_grading_method: "score",
      ...(choices > 0 ? { choice_question_count: exam.choice_question_count || choices } : {}),
    }, exam.updated_at),
    onSuccess: async (updated) => {
      queryClient.setQueryData(adminExamsQueryKeys.adminExam(exam.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.manualGradeSheet(exam.id) }),
        queryClient.invalidateQueries({ queryKey: adminResultsQueryKeys.sessionScores }),
      ]);
      if (mountedRef.current) {
        focusFrameRef.current = window.requestAnimationFrame(() => {
          focusFrameRef.current = null;
          if (mountedRef.current) onEnter();
        });
      }
    },
    onError: async (error) => {
      if (isStaleResourceConflict(error)) {
        await queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(exam.id) });
        await sheet.refetch();
      }
    },
  });

  return (
    <section className={styles.gradingEntry} aria-label="주관식·서술형 채점 안내">
      <div>
        <h2>주관식·서술형 점수 입력</h2>
        <p>{usesCorrectness
          ? "현재 O·X 입력 방식입니다. 학생별 빈칸을 모두 채우면 자동 저장됩니다. 부분점수가 필요하면 채점 방식을 직접 점수 입력으로 바꾸세요."
          : "문항별 점수 입력 → 입력 내용 확인 → 성적 확정 → 문항별 정답률 확인"}</p>
        <p>합계 점수만 입력하면 문항별 정답률은 계산되지 않습니다. 부분점수는 평균 득점에 반영됩니다.</p>
        {needsSetup && !sheet.isPending && !sheet.isError && (
          <p>{essays > 0
            ? `서술형 ${essays}문항이 있지만 현재 OMR 자동 채점만 켜져 있습니다. 서술형 채점을 켜면 기존 객관식 점수를 유지하며 문항별로 입력할 수 있습니다.`
            : "등록된 주관식·서술형 문항이 없습니다. 문항·답안 설정에서 유형과 배점을 먼저 등록하세요."}</p>
        )}
        {needsSetup && sheet.isPending && <p role="status">주관식·서술형 문항을 확인하는 중…</p>}
        {needsSetup && sheet.isError && <p role="alert">문항을 불러오지 못했습니다. 다시 불러와 주세요.</p>}
        {enableGrading.isError && <p role="alert">{isStaleResourceConflict(enableGrading.error)
          ? "다른 화면에서 설정이 바뀌었습니다. 최신 문항과 설정을 확인한 뒤 다시 시도해 주세요."
          : extractApiError(enableGrading.error, "서술형 채점을 켜지 못했습니다. 다시 시도해 주세요.")}</p>}
      </div>
      <div className={styles.gradingEntryActions}>
        {!needsSetup ? (
          <Button type="button" intent="primary" onClick={onEnter}>주관식·서술형 입력하기</Button>
        ) : sheet.isError ? (
          <Button type="button" intent="secondary" onClick={() => void sheet.refetch()}>문항 다시 불러오기</Button>
        ) : !sheet.isPending && essays > 0 ? (
          <Button type="button" intent="primary" loading={enableGrading.isPending} disabled={enableGrading.isPending || sheet.isFetching} onClick={() => enableGrading.mutate()}>서술형 채점 켜고 입력하기</Button>
        ) : !sheet.isPending && onOpenSetup ? (
          <Button type="button" intent="primary" onClick={onOpenSetup}>문항·답안 설정하기</Button>
        ) : null}
        {usesCorrectness && onOpenSetup && <Button type="button" intent="secondary" onClick={onOpenSetup}>부분점수 입력 설정</Button>}
        <Button type="button" intent="secondary" onClick={onStatistics}>문항별 정답률 보기</Button>
      </div>
    </section>
  );
}
