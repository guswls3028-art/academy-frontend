function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

function datePart(value: string): string {
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
}

export function dottedDateText(value: string | null | undefined, empty = "-"): string {
  if (!value) return empty;
  return datePart(value).replace(/-/g, ". ") + ".";
}

export function numericDateText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
}

export function numericDateTimeText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return `${numericDateText(value, empty)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function monthDayTimeText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${two(date.getMinutes())}`;
}

export function koreanDateText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function koreanDateTimeText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function koreanFullDateTimeText(value: string | null | undefined, empty = ""): string {
  const date = asDate(value);
  if (!date) return value || empty;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function numberText(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function wonText(value: number): string {
  return `${numberText(value)}원`;
}

export function bytesText(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
