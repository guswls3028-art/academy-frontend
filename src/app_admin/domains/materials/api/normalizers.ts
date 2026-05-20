// PATH: src/app_admin/domains/materials/api/normalizers.ts

export type ApiRecord = Record<string, unknown>;

export function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function listFromApiResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isApiRecord(data)) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export function numberFromApiValue(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function stringFromApiValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function booleanFromApiValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
