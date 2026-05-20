type PaginatedApiResponse<T> = {
  results?: T[];
};

export type ApiRecord = Record<string, unknown>;

export function isApiRecord(raw: unknown): raw is ApiRecord {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw);
}

export function listFromApiResponse<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (isApiRecord(raw)) {
    const results = (raw as PaginatedApiResponse<T>).results;
    if (Array.isArray(results)) return results;
  }
  return [];
}

export function countFromApiResponse(raw: unknown, fallback = 0): number {
  if (isApiRecord(raw)) {
    const count = raw.count;
    if (typeof count === "number" && Number.isFinite(count)) return count;
  }
  return fallback;
}
