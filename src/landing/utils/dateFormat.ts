// PATH: src/landing/utils/dateFormat.ts

function two(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLandingCompactDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const date = new Date(raw);
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    if (sameDay) return `${two(date.getHours())}:${two(date.getMinutes())}`;
    return `${two(date.getMonth() + 1)}.${two(date.getDate())}`;
  } catch {
    return "";
  }
}

export function formatLandingDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const date = new Date(raw);
    return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
  } catch {
    return "";
  }
}

export function formatLandingYmdDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const date = new Date(raw);
    return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
  } catch {
    return "";
  }
}

export function formatLandingYmdDateOrRaw(raw: string | null): string {
  if (!raw) return "";
  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
  } catch {
    return raw;
  }
}
