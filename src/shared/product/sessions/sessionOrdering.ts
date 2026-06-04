// PATH: src/shared/product/sessions/sessionOrdering.ts
// Session ordering SSOT.

export type SessionType = "REGULAR" | "SUPPLEMENT";

export interface SessionOrderLike {
  id?: number | null;
  order?: number | null;
  regular_order?: number | null;
  session_type?: SessionType | string | null;
  display_label?: string | null;
  title?: string | null;
  date?: string | null;
}

function positiveNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getSessionType(session: SessionOrderLike | null | undefined): SessionType {
  const raw = session?.session_type;
  if (raw === "SUPPLEMENT") return "SUPPLEMENT";
  if (raw === "REGULAR") return "REGULAR";
  return session?.title?.includes("보강") ? "SUPPLEMENT" : "REGULAR";
}

export function isSupplementSession(session: SessionOrderLike | null | undefined): boolean {
  return getSessionType(session) === "SUPPLEMENT";
}

export function getRegularOrder(session: SessionOrderLike | null | undefined): number | null {
  if (!session || isSupplementSession(session)) return null;
  return positiveNumber(session.regular_order) ?? positiveNumber(session.order);
}

export function getDisplayOrder(session: SessionOrderLike | null | undefined): number {
  return positiveNumber(session?.order) ?? Number.MAX_SAFE_INTEGER;
}

export function formatSessionLabel(session: SessionOrderLike | null | undefined): string {
  if (isSupplementSession(session)) return "보강";

  const regularOrder = getRegularOrder(session);
  if (regularOrder != null) return `${regularOrder}차시`;

  const title = (session?.title ?? "").trim();
  if (/^\d+$/.test(title)) return `${title}차시`;
  if (title) return title;
  return "-차시";
}

export function formatSessionOrderLabel(
  order: number | null | undefined,
  title?: string | null,
  sessionType?: SessionType | string | null,
  regularOrder?: number | null,
): string {
  return formatSessionLabel({
    order,
    title,
    session_type: sessionType,
    regular_order: regularOrder,
  });
}

export function sortSessionsByDisplayOrder<T extends SessionOrderLike>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const displayDiff = getDisplayOrder(a) - getDisplayOrder(b);
    if (displayDiff !== 0) return displayDiff;

    const regularA = getRegularOrder(a) ?? Number.MAX_SAFE_INTEGER;
    const regularB = getRegularOrder(b) ?? Number.MAX_SAFE_INTEGER;
    if (regularA !== regularB) return regularA - regularB;

    return (positiveNumber(a.id) ?? 0) - (positiveNumber(b.id) ?? 0);
  });
}

export function sortSessionsByDateDesc<T extends SessionOrderLike>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da && db && da !== db) return db.localeCompare(da);
    if (!da && db) return 1;
    if (da && !db) return -1;
    return getDisplayOrder(a) - getDisplayOrder(b);
  });
}

export function getNextRegularOrder(sessions: SessionOrderLike[]): number {
  const maxRegular = sessions.reduce((max, session) => {
    const regularOrder = getRegularOrder(session);
    return regularOrder != null ? Math.max(max, regularOrder) : max;
  }, 0);
  return maxRegular + 1;
}
