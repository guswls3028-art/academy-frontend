// PATH: src/app_admin/domains/fees/utils/feesStatus.ts
// 수납 상태 라벨·tone SSOT. PC 어드민·모바일 선생앱 공용.

export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

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
