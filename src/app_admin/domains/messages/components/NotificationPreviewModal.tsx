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
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  previewAttendanceNotification,
  confirmAttendanceNotification,
  previewManualNotification,
  confirmManualNotification,
  type NotificationPreviewResponse,
} from "@admin/domains/messages/api/notificationDispatch.api";
import { MODAL_WIDTH } from "@/shared/ui/modal/constants";
import { AUTO_SEND_TRIGGER_LABELS } from "@admin/domains/messages/api/messages.api";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 발송 라벨 (표시용) */
  label?: string;
  sendTo?: "parent" | "student";
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
      studentIds: number[];
      context?: Record<string, string>;
      /** 학생별 개별 변수 (성적 등) — key: student_id */
      contextPerStudent?: Record<number, Record<string, string>>;
    }
);

export default function NotificationPreviewModal(props: Props) {
  const { open, onClose, sendTo = "parent" } = props;
  const [preview, setPreview] = useState<NotificationPreviewResponse | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ sent_count: number; batch_id: string } | null>(null);

  const label =
    props.label ||
    (props.mode === "attendance"
      ? props.notificationType === "check_in" ? "입실 알림" : "결석 알림"
      : AUTO_SEND_TRIGGER_LABELS[props.trigger] || props.trigger);

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
      });
    },
    onSuccess: (data) => {
      setPreview(data);
      setAgreed(false);
      setConfirmed(false);
      setConfirmResult(null);
    },
    onError: (err: any) => {
      feedback.error(err?.response?.data?.detail || "미리보기를 불러오는데 실패했습니다.");
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
      feedback.success(`${data.sent_count}건 발송 완료`);
    },
    onError: (err: any) => {
      feedback.error(err?.response?.data?.detail || "발송에 실패했습니다.");
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
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    if (!preview?.preview_token || confirmed) return;
    confirmMutation.mutate(preview.preview_token);
  };

  const sendable = preview?.recipients?.filter((r) => !r.excluded) ?? [];
  const excluded = preview?.recipients?.filter((r) => r.excluded) ?? [];

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        title={`${label} 발송`}
        description="발송 대상과 내용을 확인한 후 발송하세요."
        type="action"
      />
      <ModalBody>
        {previewMutation.isPending && (
          <div className="py-8 text-center text-sm text-gray-500">미리보기 로딩 중...</div>
        )}

        {preview && (
          <div className="space-y-4">
            {/* 세션 정보 (출결 모드) */}
            {props.mode === "attendance" && preview.lecture_title && (
              <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3 text-sm">
                <span className="font-medium">{preview.lecture_title}</span>
                <span className="mx-1">&middot;</span>
                <span>{preview.session_title}</span>
              </div>
            )}

            {/* 발송 건수 */}
            <div className="flex items-center gap-4 text-sm">
              <span>
                발송 대상: <strong className="text-blue-600">{preview.total_count}명</strong>
              </span>
              {preview.excluded_count > 0 && (
                <span className="text-gray-500">제외: {preview.excluded_count}명</span>
              )}
            </div>

            {/* 본문 미리보기 */}
            {sendable.length > 0 && (
              <div className="rounded-md border p-3 text-sm whitespace-pre-wrap bg-white dark:bg-gray-900 max-h-32 overflow-y-auto">
                {sendable[0].message_body}
              </div>
            )}

            {/* 대상자 목록 */}
            {sendable.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">학생</th>
                      <th className="text-left px-2 py-1.5">수신 번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendable.map((r) => (
                      <tr key={r.student_id} className="border-t">
                        <td className="px-2 py-1.5">{r.student_name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 제외 대상 */}
            {excluded.length > 0 && (
              <details className="text-sm text-gray-500">
                <summary className="cursor-pointer">제외 대상 {excluded.length}명</summary>
                <ul className="mt-1 pl-4 list-disc">
                  {excluded.map((r) => (
                    <li key={r.student_id}>{r.student_name} — {r.exclude_reason}</li>
                  ))}
                </ul>
              </details>
            )}

            {/* 대상 없음 */}
            {preview.total_count === 0 && (
              <div className="py-4 text-center text-sm text-gray-500">발송 대상이 없습니다.</div>
            )}

            {/* 동의 체크 */}
            {preview.total_count > 0 && !confirmed && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="rounded"
                />
                위 {preview.total_count}명에게 {label}을 발송합니다.
              </label>
            )}

            {/* 발송 완료 */}
            {confirmed && confirmResult && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
                {confirmResult.sent_count}건 발송 완료 (배치: {confirmResult.batch_id.slice(0, 8)}...)
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
            {preview && preview.total_count > 0 && !confirmed && (
              <Button
                type="button"
                intent="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!agreed || confirmMutation.isPending}
              >
                {confirmMutation.isPending ? "발송 중..." : `${preview.total_count}건 발송`}
              </Button>
            )}
          </div>
        }
      />
    </AdminModal>
  );
}
