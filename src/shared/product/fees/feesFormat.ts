// PATH: src/shared/product/fees/feesFormat.ts
// 수납/구독 금액 표시 SSOT. Admin/teacher/student 화면 공용.

const KRW_FORMATTER = new Intl.NumberFormat("ko-KR");

type FormatKrwOptions = {
  fallback?: string;
  round?: boolean;
  unit?: boolean;
};

export function formatKRW(value: number | null | undefined, options: FormatKrwOptions = {}): string {
  if (value == null) return options.fallback ?? "-";
  const amount = options.round ? Math.round(value) : value;
  return `${KRW_FORMATTER.format(amount)}${options.unit === false ? "" : "원"}`;
}

export function formatKRWNumber(value: number | null | undefined, fallback = "-"): string {
  return formatKRW(value, { fallback, round: true, unit: false });
}

export function formatBillingDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  } catch {
    return dateStr;
  }
}
