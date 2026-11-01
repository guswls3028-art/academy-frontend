// PATH: src/shared/product/fees/feesStatus.ts
// 수납 상태 라벨·tone SSOT. PC 어드민·모바일 선생앱 공용.

import type { FeeType, InvoiceStatus, PaymentMethod } from "@/shared/api/contracts/fees";

export type { InvoiceStatus } from "@/shared/api/contracts/fees";

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  TUITION: "수강료", TEXTBOOK: "교재비", HANDOUT: "판서/프린트",
  REGISTRATION: "등록비", MATERIAL: "재료비", OTHER: "기타",
};

export const FEE_TYPE_OPTIONS = Object.entries(FEE_TYPE_LABEL).map(([value, label]) => ({ value: value as FeeType, label }));

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "현금", BANK_TRANSFER: "계좌이체", CARD: "카드", OTHER: "기타",
};
export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value: value as PaymentMethod, label }));
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "CASH";

export const FEES_STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: "미납",
  PARTIAL: "부분납",
  PAID: "완납",
  OVERDUE: "연체",
  CANCELLED: "취소",
};

/** 공용 톤 SSOT: success | warning | danger | info | neutral */
export const FEES_STATUS_TONE: Record<InvoiceStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};
