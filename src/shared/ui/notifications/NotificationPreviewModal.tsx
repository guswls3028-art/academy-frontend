// features/messages/components/NotificationPreviewModal.tsx
// 수동 알림 발송 미리보기 모달 — preview → confirm 2단계
// 출결(session 기반) + 범용(student_ids 기반) 모두 지원
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip, { type LectureInfo } from "@/shared/ui/chips/StudentNameWithLectureChip";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  previewAttendanceNotification,
  confirmAttendanceNotification,
  previewManualNotification,
  confirmManualNotification,
  type NotificationPreviewPayload,
  type NotificationConfirmResult,
} from "@/shared/api/contracts/notificationDispatch";
import { MODAL_WIDTH } from "@/shared/ui/modal/constants";
import KakaoAlimtalkPreview from "./KakaoAlimtalkPreview";
import "./NotificationPreviewModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 발송 라벨 (표시용) */
  label?: string;
  sendTo?: "parent" | "student";
  onConfirmed?: (result: NotificationConfirmResult) => void;
} & (
  | {
      /** 출결 모드 — session 기반 */
      mode: "attendance";
      sessionId: number;
      notificationType: "check_in" | "absent";
    }
    | {
      /** 범용 모드 — student_ids 기반 */
      mode: "manual";
      trigger: string;
      studentIds?: number[];
      context?: Record<string, string>;
      contextSource?: Record<string, unknown>;
      /** 학생별 개별 변수 (성적 등) — key: student_id */
      contextPerStudent?: Record<number, Record<string, string>>;
    }
);

function recipientLectures(
  preview: NotificationPreviewPayload,
): LectureInfo[] {
  if (!preview.lecture_title) return [];
  return [{
    lectureName: preview.lecture_title,
  }];
}

function handleRecipientRadioKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
    return;
  }
  const buttons = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
  );
  const currentIndex = buttons.indexOf(event.currentTarget);
  if (currentIndex < 0 || buttons.length === 0) return;

  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (currentIndex + 1) % buttons.length
          : (currentIndex - 1 + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
  buttons[nextIndex]?.click();
}

export default function NotificationPreviewModal(props: Props) {
  const { open, onClose, sendTo = "parent" } = props;
  const [preview, setPreview] = useState<NotificationPreviewPayload | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<NotificationConfirmResult | null>(null);
  const [selectedPreviewStudentId, setSelectedPreviewStudentId] = useState<number | null>(null);
  const [recipientsExpanded, setRecipientsExpanded] = useState(false);

  const label =
    props.label ||
    (props.mode === "attendance"
      ? props.notificationType === "check_in" ? "입실 알림" : "결석 알림"
      : props.trigger);

  // Preview
  const previewMutation = useMutation({
    mutationFn: () => {
      if (props.mode === "attendance") {
        return previewAttendanceNotification({
          session_id: props.sessionId,
          notification_type: props.notificationType,
          send_to: sendTo,
        });
      }
      return previewManualNotification({
        trigger: props.trigger,
        student_ids: props.studentIds,
        send_to: sendTo,
        context: props.context,
        context_per_student: props.contextPerStudent,
        context_source: props.contextSource,
      });
    },
    onSuccess: (data) => {
      setPreview(data);
      setAgreed(false);
      setConfirmed(false);
      setConfirmResult(null);
      setSelectedPreviewStudentId(null);
      setRecipientsExpanded(false);
    },
    onError: (err: unknown) => {
      feedback.error(extractApiError(err, "미리보기를 불러오는데 실패했습니다."));
    },
  });

  // Confirm
  const confirmMutation = useMutation({
    mutationFn: (token: string) => {
      if (props.mode === "attendance") return confirmAttendanceNotification(token);
      return confirmManualNotification(token);
    },
    onSuccess: (data) => {
      setConfirmed(true);
      setConfirmResult(data);
      props.onConfirmed?.(data);
      feedback.success(`${data.sent_count}건 발송 완료`);
    },
    onError: (err: unknown) => {
      feedback.error(extractApiError(err, "발송에 실패했습니다."));
    },
  });

  React.useEffect(() => {
    if (open) {
      previewMutation.mutate();
    } else {
      setPreview(null);
      setAgreed(false);
      setConfirmed(false);
      setConfirmResult(null);
      setSelectedPreviewStudentId(null);
      setRecipientsExpanded(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    if (!preview?.preview_token || confirmed) return;
    confirmMutation.mutate(preview.preview_token);
  };

  const sendable = preview?.recipients?.filter((r) => !r.excluded) ?? [];
  const excluded = preview?.recipients?.filter((r) => r.excluded) ?? [];
  const sendableCount = sendable.length;
  const selectedPreviewRecipient =
    sendable.find((recipient) => recipient.student_id === selectedPreviewStudentId)
    ?? sendable[0]
    ?? null;

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        title={`${label} 발송`}
        description="대상, 수신 번호, 알림톡 내용을 확인한 뒤 발송합니다."
        type="action"
      />
      <ModalBody>
        {previewMutation.isPending && (
          <div className="notification-preview__loading">미리보기를 준비하고 있습니다.</div>
        )}

        {preview && (
          <div className="notification-preview">
            {/* 세션 정보 (출결 모드) */}
            {props.mode === "attendance" && preview.lecture_title && (
              <div className="notification-preview__session">
                <span className="font-medium">{preview.lecture_title}</span>
                <span className="mx-1">&middot;</span>
                <span>{preview.session_title}</span>
              </div>
            )}

            {/* 발송 건수 */}
            <div className="notification-preview__summary">
              <span className="notification-preview__metric">
                <span className="notification-preview__metric-label">발송 가능</span>
                <strong>{sendableCount}명</strong>
              </span>
              {preview.excluded_count > 0 && (
                <span className="notification-preview__metric notification-preview__metric--muted">
                  <span className="notification-preview__metric-label">제외</span>
                  <strong>{preview.excluded_count}명</strong>
                </span>
              )}
            </div>

            {/* 학생별 실제 문구 + 대상 선택 */}
            {selectedPreviewRecipient && (
              <div className="notification-preview__review-grid">
                <section className="notification-preview__kakao-pane">
                  <div className="notification-preview__section-head">
                    <div>
                      <strong>카카오톡으로 이렇게 가요</strong>
                      <span>선택한 학생에게 적용된 최종 문구입니다.</span>
                    </div>
                    <StudentNameWithLectureChip
                      name={selectedPreviewRecipient.student_name}
                      lectures={recipientLectures(preview)}
                      chipSize={20}
                      density="compact"
                    />
                  </div>
                  <KakaoAlimtalkPreview channelLabel={label}>
                    {selectedPreviewRecipient.full_message_body}
                  </KakaoAlimtalkPreview>
                </section>

                <section className="notification-preview__recipients" aria-label="발송 대상 학생">
                  <div className="notification-preview__recipients-head">
                    <div>
                      <span>받는 대상</span>
                      <strong>{sendableCount}명</strong>
                    </div>
                    <span>
                      학생을 누르면 그 학생에게 갈 문구로 미리보기가 바뀝니다.
                    </span>
                  </div>

                  {sendableCount > 1 ? (
                    <button
                      type="button"
                      className="notification-preview__recipients-toggle"
                      aria-expanded={recipientsExpanded}
                      aria-controls="notification-preview-recipient-list"
                      onClick={() => setRecipientsExpanded((current) => !current)}
                    >
                      <span>{recipientsExpanded ? "학생 명단 닫기" : "전체 학생 열기"}</span>
                      <span aria-hidden="true">{recipientsExpanded ? "−" : "+"}</span>
                    </button>
                  ) : (
                    <div className="notification-preview__single-recipient">선택한 학생 1명</div>
                  )}

                  {(recipientsExpanded || sendableCount === 1) && (
                    <div
                      id="notification-preview-recipient-list"
                      className="notification-preview__recipient-list"
                      role="radiogroup"
                      aria-label="미리보기 학생 선택"
                    >
                      {sendable.map((recipient) => {
                        const selected = recipient.student_id === selectedPreviewRecipient.student_id;
                        return (
                          <button
                            key={recipient.student_id}
                            type="button"
                            className="notification-preview__recipient"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            data-selected={selected ? "true" : "false"}
                            onClick={() => setSelectedPreviewStudentId(recipient.student_id)}
                            onKeyDown={handleRecipientRadioKeyDown}
                          >
                            <span className="notification-preview__recipient-main">
                              <StudentNameWithLectureChip
                                 name={recipient.student_name}
                                lectures={recipientLectures(preview)}
                                chipSize={20}
                                density="compact"
                              />
                              <small>{recipient.phone}</small>
                            </span>
                            <span className="notification-preview__recipient-state">
                              {selected ? "미리보기 중" : "보기"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* 제외 대상 */}
            {excluded.length > 0 && (
              <details className="notification-preview__excluded">
                <summary>제외 대상 {excluded.length}명</summary>
                <ul>
                  {excluded.map((r) => (
                    <li key={r.student_id}>
                      <StudentNameWithLectureChip
                        name={r.student_name}
                        lectures={recipientLectures(preview)}
                        chipSize={20}
                        density="compact"
                      />
                      <span> - {r.exclude_reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* 대상 없음 */}
            {sendableCount === 0 && (
              <div className="notification-preview__empty">
                발송 가능한 대상이 없습니다. 제외 사유를 확인해 주세요.
              </div>
            )}

            {/* 동의 체크 */}
            {sendableCount > 0 && !confirmed && (
              <label className="notification-preview__confirm-check">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                위 {sendableCount}명에게 {label}을 발송합니다.
              </label>
            )}

            {/* 발송 완료 */}
            {confirmed && confirmResult && (
              <div className="notification-preview__done">
                <strong>{confirmResult.sent_count}건 발송 완료</strong>
                <span>배치 {confirmResult.batch_id.slice(0, 8)}</span>
                {(confirmResult.failed_count > 0 || confirmResult.blocked_count > 0) && (
                  <span>
                    실패 {confirmResult.failed_count}건 · 차단 {confirmResult.blocked_count}건
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter
        right={
          <div className="flex gap-2">
            <Button type="button" intent="secondary" size="sm" onClick={onClose}>
              {confirmed ? "닫기" : "취소"}
            </Button>
            {preview && sendableCount > 0 && !confirmed && (
              <Button
                type="button"
                intent="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!agreed || confirmMutation.isPending}
              >
                {confirmMutation.isPending ? "발송 중..." : `${sendableCount}건 발송`}
              </Button>
            )}
          </div>
        }
      />
    </AdminModal>
  );
}
