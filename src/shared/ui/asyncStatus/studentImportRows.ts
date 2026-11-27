import type { StudentImportResultRow } from "./asyncStatusStore";

export const MAX_STORED_RESULT_ROWS = 500;

export function optionalImportCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function importResultRows(
  value: unknown,
  sessionField?: "session_registration" | "sessionRegistration",
): StudentImportResultRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STORED_RESULT_ROWS).flatMap((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") return [];
    return [{
      row: typeof record.row === "number" && Number.isFinite(record.row) ? record.row : null,
      name: record.name.slice(0, 200),
      ...(sessionField && record[sessionField] === "withdrawal_preserved"
        ? { sessionRegistration: "withdrawal_preserved" as const }
        : {}),
    }];
  });
}
