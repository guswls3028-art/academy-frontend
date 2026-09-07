// PATH: src/app_admin/domains/exams/panels/ExamSubmissionsPanel.tsx
/**
 * ExamSubmissionsPanel - 제출관리 통합
 * - OMR 제출 목록 확인
 * - 학생별 제출 목록: 아바타 + 이름 + 강의칩 + 시+시험명 + 상태 + 파일 보기
 */

import { lazy, Suspense, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAdminExam } from "../hooks/useAdminExam";
import {
  listOmrUploadBatchesApi,
  type ExamSubmissionRow,
  type OmrUploadBatchItemStatus,
} from "@/shared/api/contracts/submissions";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  formatSubmissionDate,
  formatSubmissionFileSize,
} from "@admin/domains/submissions/statusMaps";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Button, EmptyState, Badge } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import { adminExamsQueryKeys } from "../queryKeys";
import styles from "./ExamSubmissionsPanel.module.css";

const OmrReviewWorkspace = lazy(
  () => import("@admin/domains/results/components/omr-review/OmrReviewWorkspace"),
);

type Props = {
  examId: number;
  sessionId?: number | null;
};

type ExamSubmissionDisplayRow = ExamSubmissionRow & {
  profile_photo_url?: string | null;
  source?: string;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
};

async function fetchExamSubmissionRows(examId: number): Promise<ExamSubmissionDisplayRow[]> {
  const response = await api.get(`/submissions/submissions/exams/${examId}/`);
  const data = response.data;
  if (Array.isArray(data)) return data as ExamSubmissionDisplayRow[];
  if (Array.isArray(data?.results)) return data.results as ExamSubmissionDisplayRow[];
  return [];
}

const OMR_LEDGER_STATUS_LABEL: Record<OmrUploadBatchItemStatus, string> = {
  pending_admission: "파일 대기",
  received: "접수됨",
  duplicate: "중복 확인",
  processing: "처리 중",
  completed: "완료",
  needs_identification: "학생 식별 필요",
  failed: "실패",
  superseded: "대체됨",
};

function omrLedgerStatusTone(
  status: OmrUploadBatchItemStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "received" || status === "processing") return "info";
  if (status === "needs_identification") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export default function ExamSubmissionsPanel({ examId, sessionId: sessionIdProp }: Props) {
  const navigate = useNavigate();
  const previewRequestIdRef = useRef<number | null>(null);
  const [previewingSubmissionId, setPreviewingSubmissionId] = useState<number | null>(null);
  const [previewErrorSubmissionId, setPreviewErrorSubmissionId] = useState<number | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<number | null>(null);
  const { lectureId, sessionId: sessionIdFromPath } = useLectureSessionParams();
  const examQ = useAdminExam(examId);
  const examTitle = examQ.data?.title ?? "";
  const sessionId = sessionIdProp ?? sessionIdFromPath ?? null;
  const canOpenScores = Number.isFinite(lectureId) && Number(lectureId) > 0
    && Number.isFinite(sessionId) && Number(sessionId) > 0;

  const q = useQuery({
    queryKey: adminExamsQueryKeys.examSubmissions(examId),
    queryFn: () => fetchExamSubmissionRows(examId),
    refetchInterval: 5000,
  });
  const batchQ = useQuery({
    queryKey: adminExamsQueryKeys.omrUploadLedger(examId),
    queryFn: listOmrUploadBatchesApi,
    refetchInterval: 5000,
  });

  const handleViewFile = async (submissionId: number) => {
    if (previewRequestIdRef.current != null) return;

    previewRequestIdRef.current = submissionId;
    setPreviewingSubmissionId(submissionId);
    setPreviewErrorSubmissionId(null);
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setPreviewErrorSubmissionId(submissionId);
      previewRequestIdRef.current = null;
      setPreviewingSubmissionId(null);
      return;
    }

    previewWindow.opener = null;

    try {
      const res = await api.get<{ url?: string }>(
        `/submissions/submissions/${submissionId}/preview/`,
      );
      const url = String(res.data?.url || "").trim();
      if (!url) throw new Error("Submission preview URL missing");
      previewWindow.location.replace(url);
    } catch {
      previewWindow.close();
      setPreviewErrorSubmissionId(submissionId);
    } finally {
      previewRequestIdRef.current = null;
      setPreviewingSubmissionId(null);
    }
  };

  const rows = q.data ?? [];
  const ledgerBatches = (batchQ.data ?? []).filter((batch) => (
    batch.exam_id === examId && (sessionId == null || batch.session_id === sessionId)
  ));
  const openScores = () => {
    if (!canOpenScores) {
      feedback.info("차시 성적 화면에서 OMR을 등록할 수 있습니다.");
      return;
    }
    navigate(`/workspace/lectures/${lectureId}/sessions/${sessionId}/scores`);
  };
  const openBatchRetry = (batchId: string) => {
    if (!canOpenScores) {
      feedback.info("차시 성적 화면에서 미접수 파일을 다시 선택할 수 있습니다.");
      return;
    }
    navigate(
      `/workspace/lectures/${lectureId}/sessions/${sessionId}/scores?omrRetryBatchId=${encodeURIComponent(batchId)}&omrRetryExamId=${examId}`,
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">OMR 제출 확인</div>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              스캔 등록은 차시 성적 화면의 상단 버튼에서 진행합니다.
            </p>
          </div>
          <Button type="button" intent="secondary" size="sm" onClick={openScores}>
            성적 탭 열기
          </Button>
        </div>
      </section>

      <section className="space-y-3" aria-label="OMR 업로드 원장">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              OMR 업로드 원장
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              선택한 답안지 수와 각 장의 처리 상태를 그대로 보존합니다.
            </p>
          </div>
          <Button type="button" intent="ghost" size="sm" onClick={() => batchQ.refetch()}>
            원장 새로고침
          </Button>
        </div>

        {batchQ.isLoading ? (
          <EmptyState scope="panel" tone="loading" title="OMR 업로드 원장 불러오는 중…" />
        ) : null}

        {batchQ.isError ? (
          <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
            OMR 업로드 원장을 불러오지 못했습니다.
          </div>
        ) : null}

        {!batchQ.isLoading && !batchQ.isError && ledgerBatches.length === 0 ? (
          <EmptyState scope="panel" tone="empty" title="최근 OMR 업로드가 없습니다." />
        ) : null}

        {ledgerBatches.map((batch) => {
          const batchItems = batch.items ?? [];
          const needsFileRetry = batchItems.some((item) => (
            item.status === "failed" && item.admission_status === "failed"
          ));
          return (
            <article
              key={batch.id}
              className="overflow-hidden rounded-lg border border-[var(--color-border-divider)]"
              data-testid={`omr-ledger-batch-${batch.id}`}
            >
              <div className="flex flex-wrap items-center gap-2 bg-[var(--color-bg-surface-soft)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  OMR {batch.total_count}장
                </span>
                <Badge variant="soft" tone="info">접수 {batch.counts.received}</Badge>
                <Badge variant="soft" tone="info">처리 {batch.counts.processing}</Badge>
                <Badge variant="soft" tone="success">완료 {batch.counts.completed}</Badge>
                <Badge variant="soft" tone="warning">
                  식별 필요 {batch.counts.needs_identification}
                </Badge>
                <Badge variant="soft" tone={batch.counts.failed > 0 ? "danger" : "neutral"}>
                  실패 {batch.counts.failed}
                </Badge>
                {needsFileRetry ? (
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    className="ml-auto"
                    onClick={() => openBatchRetry(batch.id)}
                  >
                    미접수 파일 다시 선택
                  </Button>
                ) : null}
              </div>

              {batchItems.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  이 작업의 장별 원장 정보가 아직 준비되지 않았습니다.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--color-border-divider)]" aria-label={`OMR ${batch.total_count}장 상태`}>
                  {batchItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 px-4 py-2.5"
                      data-testid="omr-ledger-item"
                    >
                      <span className="min-w-20 text-sm font-medium text-[var(--color-text-primary)]">
                        답안지 {item.ordinal}
                      </span>
                      <Badge variant="solid" tone={omrLedgerStatusTone(item.status)}>
                        {OMR_LEDGER_STATUS_LABEL[item.status]}
                      </Badge>
                      {item.identifier_status ? (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          식별 {item.identifier_status}
                        </span>
                      ) : null}
                      {item.failure_message ? (
                        <span className="min-w-0 flex-1 text-xs text-[var(--color-danger,#dc2626)]">
                          {item.failure_message}
                        </span>
                      ) : <span className="flex-1" />}
                      {item.status === "needs_identification" && item.submission_id != null ? (
                        <Button
                          type="button"
                          intent="secondary"
                          size="sm"
                          onClick={() => setReviewSubmissionId(item.submission_id)}
                        >
                          식별하기
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </section>

      {/* 제출 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            제출관리 · <span className="text-[var(--color-text-muted)]">{rows.length}건</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              intent="ghost"
              size="sm"
              onClick={() => {
                void q.refetch();
                void batchQ.refetch();
              }}
            >
              새로고침
            </Button>
          </div>
        </div>

        {q.isLoading && (
          <EmptyState scope="panel" tone="loading" title="제출 목록 불러오는 중…" />
        )}

        {q.isError && (
          <div className="rounded border border-red-600/30 bg-red-600/10 p-3 text-sm text-red-700">
            제출 목록 조회 실패
          </div>
        )}

        {!q.isLoading && rows.length === 0 && !q.isError && (
          <EmptyState scope="panel" tone="empty" title="아직 제출된 시험이 없습니다." />
        )}

        {rows.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)]">
            {rows.map((r) => {
              const tone = SUBMISSION_STATUS_TONE[r.status];
              const statusLabel = SUBMISSION_STATUS_LABEL[r.status];
              const hasFile = Boolean(r.file_key);
              const needsIdentification = r.status === "needs_identification";
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* 아바타 + 이름 + 강의칩 (SSOT: StudentNameWithLectureChip) */}
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={32}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    chipSize={18}
                    clinicHighlight={r.name_highlight_clinic_target === true}
                  />

                  {/* 시+시험명 뱃지 */}
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${styles.examBadge}`}
                  >
                    시 {examTitle}
                  </span>

                  {/* 파일 정보 */}
                  {r.file_type && (
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      {r.file_type} {formatSubmissionFileSize(r.file_size)}
                    </span>
                  )}

                  {/* 점수 */}
                  {r.score != null && (
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] flex-shrink-0">
                      {r.score}점
                    </span>
                  )}

                  <span className="flex-1" />

                  {/* 상태 뱃지 */}
                  <Badge variant="solid" tone={tone} className="flex-shrink-0">
                    {statusLabel}
                  </Badge>

                  {/* 제출 시각 */}
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    {formatSubmissionDate(r.created_at)}
                  </span>

                  {/* 식별 필요 답안은 파일 새 창 대신 해당 검토 화면으로 바로 연결 */}
                  {needsIdentification ? (
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      onClick={() => setReviewSubmissionId(r.id)}
                    >
                      식별하기
                    </Button>
                  ) : hasFile ? (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {previewErrorSubmissionId === r.id && (
                        <span
                          role="status"
                          className="text-xs font-medium text-[var(--color-danger,#dc2626)]"
                        >
                          파일을 열 수 없습니다.
                        </span>
                      )}
                      <Button
                        type="button"
                        intent="ghost"
                        size="sm"
                        disabled={previewingSubmissionId != null}
                        onClick={() => void handleViewFile(r.id)}
                      >
                        {previewingSubmissionId === r.id ? "여는 중…" : "보기"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          실패 · 지연은 정상 흐름입니다. 처리 중 오류가 발생해도 재업로드 · 재처리가 언제든 가능합니다.
        </p>
      </section>

      {reviewSubmissionId != null && (
        <Suspense fallback={null}>
          <OmrReviewWorkspace
            examId={examId}
            examTitle={examTitle}
            initialSubmissionId={reviewSubmissionId}
            open
            onClose={() => {
              setReviewSubmissionId(null);
              void q.refetch();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
