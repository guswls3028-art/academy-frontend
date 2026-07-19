// features/messages/components/NotificationPreviewModal.tsx
// 수동 알림 발송 미리보기 모달 — preview → confirm 2단계
// 출결(session 기반) + 범용(student_ids 기반) 모두 지원
import { useEffect, useRef, useState } from "react";
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
import {
  NotificationRequestLifecycle,
  getNotificationConfirmPresentation,
  notificationConfirmHeadline,
} from "./notificationDispatchState";
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

type PreviewRequest =
  | {
      mode: "attendance";
      session_id: number;
      notification_type: "check_in" | "absent";
      send_to: "parent" | "student";
    }
  | {
      mode: "manual";
      trigger: string;
      student_ids?: number[];
      send_to: "parent" | "student";
      context?: Record<string, string>;
      context_per_student?: Record<number, Record<string, string>>;
      context_source?: Record<string, unknown>;
    };

function buildPreviewRequest(props: Props, sendTo: "parent" | "student"): PreviewRequest {
  if (props.mode === "attendance") {
    return {
      mode: "attendance",
      session_id: props.sessionId,
      notification_type: props.notificationType,
      send_to: sendTo,
    };
  }
  return {
    mode: "manual",
    trigger: props.trigger,
    student_ids: props.studentIds,
    send_to: sendTo,
    context: props.context,
    context_per_student: props.contextPerStudent,
    context_source: props.contextSource,
  };
}

function fetchPreview(request: PreviewRequest, signal: AbortSignal) {
  if (request.mode === "attendance") {
    return previewAttendanceNotification({
      session_id: request.session_id,
      notification_type: request.notification_type,
      send_to: request.send_to,
    }, signal);
  }
  return previewManualNotification({
    trigger: request.trigger,
    student_ids: request.student_ids,
    send_to: request.send_to,
    context: request.context,
    context_per_student: request.context_per_student,
    context_source: request.context_source,
  }, signal);
}

function recipientLectures(
  recipient: NotificationPreviewPayload["recipients"][number],
  preview: NotificationPreviewPayload,
): LectureInfo[] {
  const explicitLectures = recipient.lectures
    ?.map((lecture) => ({
      lectureName: lecture.lecture_title || lecture.lecture_name || lecture.title,
      color: lecture.lecture_color ?? lecture.color,
      chipLabel: lecture.lecture_chip_label ?? lecture.chip_label,
    }))
    .filter((lecture) => Boolean(lecture.lectureName));
  if (explicitLectures?.length) return explicitLectures;

  const lectureName = recipient.lecture_title || preview.lecture_title;
  if (!lectureName) return [];
  return [{
    lectureName,
    color: recipient.lecture_color ?? recipient.color,
    chipLabel: recipient.lecture_chip_label ?? recipient.chip_label,
  }];
}

export default function NotificationPreviewModal(props: Props) {
  const { open, onClose, sendTo = "parent" } = props;
  const [preview, setPreview] = useState<NotificationPreviewPayload | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<NotificationConfirmResult | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [previewRefreshId, setPreviewRefreshId] = useState(0);
  const requestLifecycleRef = useRef(new NotificationRequestLifecycle());

  const label =
    props.label ||
    (props.mode === "attendance"
      ? props.notificationType === "check_in" ? "입실 알림" : "결석 알림"
      : props.trigger);

  const previewRequest = buildPreviewRequest(props, sendTo);
  const previewRequestKey = JSON.stringify(previewRequest);

  useEffect(() => {
    const lifecycle = requestLifecycleRef.current;
    const confirmInFlight = lifecycle.hasConfirmInFlight();
    const requestId = lifecycle.startPreview();
    setPreview(null);
    setAgreed(false);
    setConfirmed(false);
    setConfirmResult(null);
    setConfirmPending(confirmInFlight);
    setPreviewPending(open);
    if (!open || confirmInFlight) return undefined;

    const controller = new AbortController();
    void fetchPreview(previewRequest, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || !lifecycle.isPreviewCurrent(requestId)) return;
        setPreview(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || !lifecycle.isPreviewCurrent(requestId)) return;
        feedback.error(extractApiError(err, "미리보기를 불러오는데 실패했습니다."));
      })
      .finally(() => {
        if (lifecycle.isPreviewCurrent(requestId)) setPreviewPending(false);
      });

    return () => {
      controller.abort();
      lifecycle.invalidatePreview(requestId);
    };
  }, [open, previewRequestKey, previewRefreshId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (requestLifecycleRef.current.hasConfirmInFlight()) return;
    onClose();
  };

  const handleConfirm = async () => {
    const token = preview?.preview_token;
    const lifecycle = requestLifecycleRef.current;
    if (!token || confirmed || lifecycle.hasConfirmInFlight()) return;

    const ticket = lifecycle.startConfirm(token);
    if (!ticket) return;
    const mode = props.mode;
    setConfirmPending(true);
    try {
      const data = mode === "attendance"
        ? await confirmAttendanceNotification(token)
        : await confirmManualNotification(token);
      if (!lifecycle.isConfirmCurrent(ticket)) return;
      setConfirmed(true);
      setConfirmResult(data);
      props.onConfirmed?.(data);
      const presentation = getNotificationConfirmPresentation(data);
      feedback[presentation.tone](presentation.feedback);
    } catch (err: unknown) {
      if (!lifecycle.isConfirmCurrent(ticket)) return;
      feedback.error(extractApiError(err, "발송에 실패했습니다."));
    } finally {
      const finish = lifecycle.finishConfirm(ticket);
      if (finish.released) {
        setConfirmPending(false);
        if (finish.needsFreshPreview) {
          setPreviewRefreshId((current) => current + 1);
        }
      }
    }
  };

  const sendable = preview?.recipients?.filter((r) => !r.excluded) ?? [];
  const excluded = preview?.recipients?.filter((r) => r.excluded) ?? [];
  const sendableCount = sendable.length;

  return (
    <AdminModal open={open} onClose={handleClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        title={`${label} 발송`}
        description="대상, 수신 번호, 알림톡 내용을 확인한 뒤 발송합니다."
        type="action"
      />
      <ModalBody>
        {previewPending && (
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

            {/* 본문 미리보기 */}
            {sendable.length > 0 && (
              <div className="notification-preview__message">
                <div className="notification-preview__message-bar">
                  <span>알림톡 미리보기</span>
                  <StudentNameWithLectureChip
                    name={sendable[0].student_name}
                    lectures={recipientLectures(sendable[0], preview)}
                    chipSize={20}
                    density="compact"
                  />
                </div>
                <div className="notification-preview__message-body">
                  {sendable[0].message_body}
                </div>
              </div>
            )}

            {/* 대상자 목록 */}
            {sendable.length > 0 && (
              <div className="notification-preview__table-wrap">
                <table className="notification-preview__table">
                  <thead>
                    <tr>
                      <th>학생</th>
                      <th>수신 번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendable.map((r) => (
                      <tr key={r.student_id}>
                        <td>
                          <StudentNameWithLectureChip
                            name={r.student_name}
                            lectures={recipientLectures(r, preview)}
                            chipSize={20}
                            density="compact"
                          />
                        </td>
                        <td>{r.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                        lectures={recipientLectures(r, preview)}
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
                <strong>{notificationConfirmHeadline(confirmResult)}</strong>
                <span>배치 {confirmResult.batch_id.slice(0, 8)}</span>
                {(confirmResult.sent_count > 0 || confirmResult.pending_count > 0) && (
                  <span>
                    발송 완료 {confirmResult.sent_count}건 · 발송 대기 {confirmResult.pending_count}건
                  </span>
                )}
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
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={handleClose}
              disabled={confirmPending}
            >
              {confirmed ? "닫기" : "취소"}
            </Button>
            {preview && sendableCount > 0 && !confirmed && (
              <Button
                type="button"
                intent="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!agreed || confirmPending}
              >
                {confirmPending ? "발송 중..." : `${sendableCount}건 발송`}
              </Button>
            )}
          </div>
        }
      />
    </AdminModal>
  );
}
