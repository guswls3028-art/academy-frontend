import dayjs from "dayjs";

export function todayISO(): string {
  return dayjs().format("YYYY-MM-DD");
}

export function parseTimeRange(value: string): { start: string; end: string } {
  const trimmed = (value || "").trim();
  const separatorIndex = trimmed.indexOf("~");
  if (separatorIndex >= 0) {
    return {
      start: trimmed.slice(0, separatorIndex).trim(),
      end: trimmed.slice(separatorIndex + 1).trim(),
    };
  }
  return { start: trimmed, end: "" };
}

export function durationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  let difference = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (difference < 0) difference += 24 * 60;
  return difference;
}

export function toHHmmss(value: string): string {
  if (!value?.trim()) return "";
  const parts = value.trim().split(":");
  if (parts.length >= 3) return value.trim();
  const hour = parts[0] ?? "00";
  const minute = (parts[1] ?? "00").padStart(2, "0");
  return `${hour.padStart(2, "0")}:${minute}:00`;
}

export function representativeSummary(
  values: readonly string[],
  total: number,
  unit: string,
): string {
  const names = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  if (names.length === 0) return `${total}${unit}`;
  const visible = names.slice(0, 3);
  const remaining = Math.max(0, total - visible.length);
  return `${visible.join(", ")}${remaining > 0 ? ` 외 ${remaining}${unit}` : ""}`;
}

export const filterChipClass = (active: boolean): string =>
  active
    ? "clinic-create__filter-chip clinic-create__filter-chip--active"
    : "clinic-create__filter-chip";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  const json = JSON.stringify(value);
  return json ?? String(value);
}

function formatDetailItem(item: unknown): string {
  if (isRecord(item) && typeof item.msg === "string") return item.msg;
  return stringifyValue(item);
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isRecord(error) || !isRecord(error.response)) return fallback;
  const responseData = error.response.data;
  if (!responseData) return fallback;
  if (!isRecord(responseData)) return stringifyValue(responseData);

  const detail = responseData.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(formatDetailItem).join(", ");
  if (isRecord(detail)) return JSON.stringify(detail);

  const parts = Object.entries(responseData).map(([key, value]) => {
    const valueText = Array.isArray(value)
      ? value.map(stringifyValue).join(", ")
      : stringifyValue(value);
    return `${key}: ${valueText}`;
  });
  return parts.length ? parts.join(" · ") : fallback;
}
