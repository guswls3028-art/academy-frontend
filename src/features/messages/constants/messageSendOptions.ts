// PATH: src/features/messages/constants/messageSendOptions.ts
// 발송 유형 공용 상수 — SMS + 알림톡, SMS만, 알림톡만 (기본값 옵션)
// 메시지 발송 모달, 자동발송, 학생 도메인 보내기에서 동일하게 사용

import type { MessageMode } from "../api/messages.api";

/** 자동발송/설정용 message_mode 라벨 (백엔드 sms | alimtalk | both) */
export const MESSAGE_MODE_LABELS: Record<MessageMode, string> = {
  sms: "SMS만",
  alimtalk: "알림톡만",
  both: "알림톡→SMS 폴백",
};

/** 발송 유형 3가지 표시명 (기본 옵션) */
export const SEND_TYPE_OPTIONS = [
  { key: "sms_and_alimtalk" as const, label: "SMS + 알림톡" },
  { key: "sms" as const, label: "SMS만" },
  { key: "alimtalk" as const, label: "알림톡만" },
] as const;

/**
 * 메시지 발송 모달 열 때 기본 선택값: SMS + 알림톡 (SMS·알림톡 둘 다 발송).
 * sms_allowed가 false면 알림톡만 선택.
 */
export function getDefaultSendModalModes(smsAllowed: boolean): { useSms: boolean; useAlimtalk: boolean } {
  return {
    useSms: smsAllowed,
    useAlimtalk: true,
  };
}

/** 자동발송/가입 발송 설정에서 기본 message_mode (설정 없을 때) */
export const DEFAULT_MESSAGE_MODE: MessageMode = "both";
