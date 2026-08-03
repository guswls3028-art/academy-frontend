import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

import {
  approveSegmentationReview,
  fetchSegmentationReview,
  type SegmentationReviewItem,
} from "../api/segmentationReview";
import { adminExamsQueryKeys } from "../queryKeys";
import styles from "./ExamSegmentationReview.module.css";

type DraftItem = SegmentationReviewItem & { numberInput: string };

export default function ExamSegmentationReview({ examId }: { examId: number }) {
  const queryClient = useQueryClient();
  const review = useQuery({
    queryKey: ["exam-segmentation-review", examId],
    queryFn: () => fetchSegmentationReview(examId),
  });
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (!review.data) return;
    setItems(
      review.data.items.map((item) => ({
        ...item,
        numberInput: String(item.number),
      })),
    );
  }, [review.data]);

  const selected = items.filter((item) => item.included);
  const parsedNumbers = selected.map((item) => Number(item.numberInput));
  const hasInvalidNumber = parsedNumbers.some(
    (number) => !Number.isInteger(number) || number < 1 || number > 999,
  );
  const hasDuplicateNumber = new Set(parsedNumbers).size !== parsedNumbers.length;
  const canApprove =
    selected.length > 0 && !hasInvalidNumber && !hasDuplicateNumber;
  const teacherExplanationCount = selected.filter(
    (item) => item.has_teacher_explanation,
  ).length;

  const approve = useMutation({
    mutationFn: () =>
      approveSegmentationReview(
        examId,
        items.map((item) => ({
          id: item.id,
          number: Number(item.numberInput),
          included: item.included,
        })),
      ),
    onSuccess: async (result) => {
      feedback.success(`${result.total_questions}개 문항을 확정했습니다.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examQuestions(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examExplanations(examId) }),
        queryClient.invalidateQueries({ queryKey: ["exam-segmentation-review", examId] }),
      ]);
    },
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "문항을 확정하지 못했습니다."));
    },
  });

  const update = (id: number, patch: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  if (review.isLoading) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="문항·해설 맞춤 확인 준비 중…" />;
  }
  if (review.isError || !review.data) {
    return (
      <EmptyState
        mode="embedded"
        scope="panel"
        tone="error"
        title="검수 후보를 불러오지 못했습니다."
        description={extractApiError(review.error, "잠시 후 다시 시도해 주세요.")}
      />
    );
  }

  return (
    <section className={styles.review} aria-labelledby="segmentation-review-title">
      <header className={styles.reviewHeader}>
        <div>
          <span className={styles.eyebrow}>확정 전 마지막 확인</span>
          <h3 id="segmentation-review-title">문항·해설 맞춤 확인</h3>
          <p>
            왼쪽 문제와 오른쪽 선생님 해설이 같은 번호인지 확인해 주세요.
            원본 해설의 내용은 바꾸지 않습니다.
          </p>
        </div>
        <div className={styles.counts} aria-label="검수 현황">
          <strong>{selected.length}</strong><span>수록</span>
          <i aria-hidden />
          <strong>{teacherExplanationCount}</strong><span>원본 해설</span>
        </div>
      </header>

      <div className={styles.sourceLine}>
        <Badge tone="info" shape="square">원본 보존</Badge>
        <span>{review.data.source_filename || "업로드 시험지"}</span>
      </div>

      <div className={styles.list}>
        {items.map((item) => (
          <article
            key={item.id}
            className={`${styles.card} ${item.included ? "" : styles.excluded}`}
          >
            <div className={styles.cardRail}>
              <label>
                <span>문항 번호</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  inputMode="numeric"
                  value={item.numberInput}
                  disabled={!item.included || approve.isPending}
                  aria-label={`${item.position}번째 후보 문항 번호`}
                  onChange={(event) => update(item.id, { numberInput: event.target.value })}
                />
              </label>
              <button
                type="button"
                aria-pressed={item.included}
                disabled={approve.isPending}
                onClick={() => update(item.id, { included: !item.included })}
              >
                {item.included ? "수록" : "제외"}
              </button>
            </div>

            <figure className={styles.proofPane}>
              <figcaption>문제 이미지</figcaption>
              {item.problem_image_url ? (
                <img src={item.problem_image_url} alt={`${item.numberInput}번 문제 후보`} loading="lazy" />
              ) : (
                <div className={styles.missing}>문제 이미지 없음</div>
              )}
            </figure>

            <figure className={`${styles.proofPane} ${styles.explanationPane}`}>
              <figcaption>
                선생님 원본 해설
                {item.has_teacher_explanation && <Badge tone="success" size="sm">보존됨</Badge>}
              </figcaption>
              {item.explanation_image_url ? (
                <img src={item.explanation_image_url} alt={`${item.numberInput}번 선생님 원본 해설`} loading="lazy" />
              ) : item.explanation_text ? (
                <p>{item.explanation_text}</p>
              ) : (
                <div className={styles.missing}>연결된 해설 없음</div>
              )}
            </figure>
          </article>
        ))}
      </div>

      <footer className={styles.reviewFooter}>
        <div role={hasInvalidNumber || hasDuplicateNumber ? "alert" : undefined}>
          {hasInvalidNumber
            ? "문항 번호는 1~999 사이의 정수로 입력해 주세요."
            : hasDuplicateNumber
              ? "수록할 문항 번호가 중복되었습니다."
              : `${selected.length}개 문항을 확정하면 채점과 오답노트에 바로 연결됩니다.`}
        </div>
        <Button
          intent="primary"
          disabled={!canApprove || approve.isPending}
          loading={approve.isPending}
          onClick={() => approve.mutate()}
        >
          {approve.isPending ? "확정 중" : `${selected.length}개 문항 확정`}
        </Button>
      </footer>
    </section>
  );
}
