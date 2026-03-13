// PATH: src/features/messages/constants/messageSendOptions.ts
// 발송 방식 공용 상수 — 메시지, 알림톡, 모두 (SSOT). 메시지 발송 모달, 자동발송, 학생 도메인에서 동일 사용.

import type { MessageMode } from "../api/messages.api";

/** 발송 방식 라벨 (SSOT). 백엔드 sms | alimtalk | both */
export const MESSAGE_MODE_LABELS: Record<MessageMode, string> = {
  sms: "메시지",
  alimtalk: "알림톡",
  both: "모두",
};

/** 발송 유형 3가지 표시명 (단일/다중 선택 UI 공용) */
export const SEND_TYPE_OPTIONS = [
  { key: "sms_and_alimtalk" as const, label: "모두" },
  { key: "sms" as const, label: "메시지" },
  { key: "alimtalk" as const, label: "알림톡" },
] as const;

/**
 * 메시지 발송 모달 열 때 기본 선택값: 모두(메시지+알림톡).
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
