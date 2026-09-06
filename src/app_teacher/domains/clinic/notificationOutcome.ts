import type {
  TeacherClinicNotificationOutcome,
  TeacherClinicRecipient,
} from "./api";

export type ClinicOutcomeNotice = {
  tone: "success" | "error" | "info";
  message: string;
};

const RECIPIENT_LABELS: Record<TeacherClinicRecipient, string> = {
  student: "학생",
  parent: "학부모",
  both: "학생·학부모",
};

export function formatClinicOutcomeNotice(
  actionLabel: string,
  notification?: TeacherClinicNotificationOutcome,
): ClinicOutcomeNotice {
  if (!notification) {
    return { tone: "success", message: `${actionLabel} 처리가 완료되었습니다.` };
  }

  const recipient = RECIPIENT_LABELS[notification.send_to] ?? notification.send_to;
  if (notification.failed > 0) {
    return {
      tone: "error",
      message: `${actionLabel} 처리는 완료됐지만 알림톡 요청 ${notification.requested}건 중 ${notification.failed}건이 실패했습니다. 수신자: ${recipient}`,
    };
  }
  if (notification.requested === 0) {
    return {
      tone: "info",
      message: `${actionLabel} 처리는 완료됐지만 알림톡 요청은 0건입니다. 수신자: ${recipient}`,
    };
  }
  return {
    tone: "success",
    message: `${actionLabel} 처리 완료 · 알림톡 요청 ${notification.requested}건 접수. 수신자: ${recipient}. 실제 전달 결과는 발송 내역에서 확인하세요.`,
  };
}
