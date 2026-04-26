// PATH: src/app_admin/domains/messages/constants/messageSendOptions.ts
// 발송 방식 공용 상수 — 알림톡 전용 (SSOT).

import type { MessageMode } from "../api/messages.api";

/** 발송 방식 라벨 (SSOT). */
export const MESSAGE_MODE_LABELS: Record<MessageMode, string> = {
  alimtalk: "알림톡",
};

/** 발송 유형 표시명 (단일 선택 UI 공용) */
export const SEND_TYPE_OPTIONS = [
  { key: "alimtalk" as const, label: "알림톡" },
] as const;

/**
 * 메시지 발송 모달 열 때 기본 선택값.
 * 알림톡만 선택.
 */
export function getDefaultSendModalModes(_smsAllowed: boolean): { useSms: boolean; useAlimtalk: boolean } {
  void _smsAllowed;
  return {
    useSms: false,
    useAlimtalk: true,
  };
}

/** 자동발송/가입 발송 설정에서 기본 message_mode (설정 없을 때) */
export const DEFAULT_MESSAGE_MODE: MessageMode = "alimtalk";
