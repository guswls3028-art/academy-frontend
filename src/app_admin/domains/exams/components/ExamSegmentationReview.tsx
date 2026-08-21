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

type ExplanationVariant = "reconstructed" | "source_attachment";
type DraftItem = SegmentationReviewItem & {
  numberInput: string;
  answerInput: string;
  explanationVariant: ExplanationVariant;
  includeExplanationText: boolean;
};

const SOURCE_ISSUE_LABELS: Record<string, string> = {
  answer_coverage_incomplete: "일부 문항의 정답을 인식하지 못했습니다.",
  explanation_coverage_incomplete: "일부 문항의 해설을 인식하지 못했습니다.",
  answer_source_processing_failed: "정답지 처리에 실패해 원본 검수가 필요합니다.",
  explanation_source_processing_failed: "해설지 처리에 실패해 원본 검수가 필요합니다.",
  answer_source_preserved_manual_review: "정답지 원본은 보존했으며 직접 입력이 필요합니다.",
  explanation_source_preserved_manual_review: "해설지 원본은 보존했으며 직접 확인이 필요합니다.",
  answer_entries_not_recognized: "정답지에서 번호별 정답을 찾지 못했습니다.",
  explanation_entries_not_recognized: "해설지에서 번호별 해설을 찾지 못했습니다.",
};

function ProblemCropPreview({
  item,
}: {
  item: DraftItem;
}) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const sourceUrl = item.crop_adjustable
    ? item.explanation_image_url
    : item.problem_image_url;

  if (!sourceUrl) {
    return <div className={styles.missing}>문제 이미지 없음</div>;
  }
  if (!item.crop_adjustable || !item.explanation_image_url) {
    return <img src={sourceUrl} alt={`${item.numberInput}번 문제 후보`} loading="lazy" />;
  }
  if (previewFailed) {
    return (
      <img
        src={item.problem_image_url}
        alt={`${item.numberInput}번 문제 후보`}
        loading="lazy"
      />
    );
  }

  const cropHeight = dimensions
    ? Math.max(1, Math.round(dimensions.height * item.problem_crop_ratio))
    : 0;
  return (
    <div className={styles.cropPreviewWrap}>
      <img
        className={styles.measureImage}
        src={item.explanation_image_url}
        alt=""
        onError={() => setPreviewFailed(true)}
        onLoad={(event) => {
          setDimensions({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
      />
      {dimensions ? (
        <svg
          className={styles.cropPreview}
          viewBox={`0 0 ${dimensions.width} ${cropHeight}`}
          role="img"
          aria-label={`${item.numberInput}번 문제 영역 미리보기`}
        >
          <image
            href={item.explanation_image_url}
            width={dimensions.width}
            height={dimensions.height}
            preserveAspectRatio="xMinYMin meet"
          />
        </svg>
      ) : (
        <div className={styles.missing}>문제 영역 미리보기 준비 중…</div>
      )}
    </div>
  );
}

export default function ExamSegmentationReview({
  examId,
  onApproved,
}: {
  examId: number;
  onApproved?: () => void;
}) {
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
        answerInput: item.answer ?? "",
        explanationVariant: "reconstructed",
        includeExplanationText: !item.explanation_text_requires_review,
      })),
    );
  }, [review.data]);

  const selected = items.filter((item) => item.included);
  const parsedNumbers = selected.map((item) => Number(item.numberInput));
  const hasInvalidNumber = parsedNumbers.some(
    (number) => !Number.isInteger(number) || number < 1 || number > 999,
  );
  const hasDuplicateNumber = new Set(parsedNumbers).size !== parsedNumbers.length;
  const hasInvalidAnswer = selected.some((item) => item.answerInput.length > 500);
  const canApprove =
    selected.length > 0 && !hasInvalidNumber && !hasDuplicateNumber && !hasInvalidAnswer;
  const answerCount = selected.filter((item) => item.answerInput.trim().length > 0).length;
  const teacherExplanationCount = selected.filter(
    (item) => item.has_teacher_explanation,
  ).length;
  const usesHangulBodyEndnotes = items.some(
    (item) => item.engine === "hwp_body_endnote" || item.engine === "hwpx_body_endnote",
  );

  const approve = useMutation({
    mutationFn: () =>
      approveSegmentationReview(
        examId,
        items.map((item) => ({
          id: item.id,
          number: Number(item.numberInput),
          included: item.included,
          problem_crop_ratio: item.crop_adjustable
            ? item.problem_crop_ratio
            : undefined,
          explanation_variant: item.explanationVariant,
          answer: item.answerInput.trim(),
          include_explanation_text: item.includeExplanationText,
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
      onApproved?.();
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
          <h3 id="segmentation-review-title">문항·정답·해설 맞춤 확인</h3>
          <p>
            문제, 정답, 선생님 해설이 같은 번호인지 확인해 주세요.
            시스템은 새 풀이를 쓰지 않고 업로드 원본을 자동 인식해 연결합니다.
            원문을 바꾸지 않은 제안 상태이므로 확정 전에 번호와 내용을 확인해 주세요.
          </p>
        </div>
        <div className={styles.counts} aria-label="검수 현황">
          <strong>{selected.length}</strong><span>수록</span>
          <i aria-hidden />
          <strong>{answerCount}</strong><span>정답</span>
          <i aria-hidden />
          <strong>{teacherExplanationCount}</strong><span>원본 해설</span>
        </div>
      </header>

      <div className={styles.sourceLine}>
        <Badge tone="info" shape="square">원본 보존</Badge>
        {usesHangulBodyEndnotes && (
          <Badge tone="success" shape="square">한글 본문·미주 분리</Badge>
        )}
        <span>{review.data.source_filename || "업로드 시험지"}</span>
      </div>

      {review.data.paired_source_status === "partial" && (
        <div className={styles.partialNotice} role="alert">
          <div>
            <strong>부분 인식 · 확정 전 보완 필요</strong>
            <p>인식하지 못한 값은 비워 두었습니다. 원본을 보고 직접 입력하거나 자료를 보완해 다시 인식하세요.</p>
          </div>
          <ul>
            {review.data.source_issues.map((issue) => (
              <li key={issue}>{SOURCE_ISSUE_LABELS[issue] ?? issue}</li>
            ))}
          </ul>
        </div>
      )}

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
              <label className={styles.answerField}>
                <span>
                  정답
                  {item.answer_missing && <em>미인식</em>}
                </span>
                <input
                  type="text"
                  value={item.answerInput}
                  maxLength={500}
                  disabled={!item.included || approve.isPending}
                  aria-label={`${item.numberInput}번 정답`}
                  placeholder="직접 입력"
                  onChange={(event) => update(item.id, { answerInput: event.target.value })}
                />
                {item.answer_source_image_url && (
                  <a
                    href={item.answer_source_image_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    정답지 원본 보기
                  </a>
                )}
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
                <ProblemCropPreview item={item} />
              ) : <div className={styles.missing}>문제 이미지 없음</div>}
              {item.crop_adjustable && (
                <label className={styles.cropControl}>
                  <span>
                    문제 영역 높이
                    <output>{Math.round(item.problem_crop_ratio * 100)}%</output>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={98}
                    step={1}
                    value={Math.round(item.problem_crop_ratio * 100)}
                    disabled={!item.included || approve.isPending}
                    onChange={(event) => update(item.id, {
                      problem_crop_ratio: Number(event.target.value) / 100,
                    })}
                    aria-label={`${item.numberInput}번 문제 영역 높이`}
                  />
                  <small>풀이가 보이면 줄이고, 문제·보기·도표가 잘리면 늘려 주세요.</small>
                </label>
              )}
            </figure>

            <figure className={`${styles.proofPane} ${styles.explanationPane}`}>
              <figcaption>
                {item.explanationVariant === "source_attachment"
                  ? "삽입 그림 원본"
                  : "번호 확정 원문 해설"}
                {item.has_teacher_explanation && <Badge tone="success" size="sm">보존됨</Badge>}
                {item.explanation_missing && <Badge tone="warning" size="sm">미인식</Badge>}
              </figcaption>
              {item.source_attachment_image_url && (
                <div className={styles.explanationVariant} role="group" aria-label={`${item.numberInput}번 해설 원본 선택`}>
                  <button
                    type="button"
                    data-active={item.explanationVariant === "reconstructed" ? "" : undefined}
                    disabled={!item.included || approve.isPending}
                    onClick={() => update(item.id, { explanationVariant: "reconstructed" })}
                  >
                    본문·수식 <small>권장</small>
                  </button>
                  <button
                    type="button"
                    data-active={item.explanationVariant === "source_attachment" ? "" : undefined}
                    disabled={!item.included || approve.isPending}
                    onClick={() => update(item.id, { explanationVariant: "source_attachment" })}
                  >
                    삽입 그림 <small>직접 확인</small>
                  </button>
                </div>
              )}
              {(item.explanationVariant === "source_attachment"
                ? item.source_attachment_image_url
                : item.explanation_image_url) ? (
                <img
                  src={item.explanationVariant === "source_attachment"
                    ? item.source_attachment_image_url
                    : item.explanation_image_url}
                  alt={`${item.numberInput}번 ${item.explanationVariant === "source_attachment" ? "삽입 그림" : "번호 확정 원문 해설"}`}
                  loading="lazy"
                />
              ) : item.explanation_text ? (
                <div className={styles.ocrText}>
                  <Badge tone="warning" size="sm">원본 자동 인식 · 검수 필요</Badge>
                  <p>{item.explanation_text}</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.includeExplanationText}
                      disabled={!item.included || approve.isPending}
                      onChange={(event) => update(item.id, { includeExplanationText: event.target.checked })}
                    />
                    이 텍스트가 원본과 같을 때만 해설로 저장
                  </label>
                </div>
              ) : (
                <div className={styles.missing}>연결된 해설 없음</div>
              )}
              {item.source_attachment_image_url && (
                <small className={styles.explanationGuidance} data-warning={item.explanationVariant === "source_attachment" ? "" : undefined}>
                  {item.explanationVariant === "source_attachment"
                    ? "삽입 그림에는 표지나 인접 문항이 섞일 수 있습니다. 왼쪽 문제와 같을 때만 확정하세요."
                    : "한글 미주 번호에 직접 연결된 본문과 수식을 재현했습니다."}
                </small>
              )}
            </figure>
          </article>
        ))}
      </div>

      <footer className={styles.reviewFooter}>
        <div role={hasInvalidNumber || hasDuplicateNumber || hasInvalidAnswer ? "alert" : undefined}>
          {hasInvalidNumber
            ? "문항 번호는 1~999 사이의 정수로 입력해 주세요."
            : hasDuplicateNumber
              ? "수록할 문항 번호가 중복되었습니다."
              : hasInvalidAnswer
                ? "정답은 문항당 500자 이내로 입력해 주세요."
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
