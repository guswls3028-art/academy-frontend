import type { OmrReviewRow } from "./omrReviewApi";

export type OmrReviewCategory = "ok" | "noid" | "flag" | "failed" | "archived";
export type OmrReviewFilterKey = "all" | OmrReviewCategory;

export function isArchivedOmrReviewRow(row: Pick<OmrReviewRow, "status" | "archived">): boolean {
  return row.archived === true || String(row.status || "").toLowerCase() === "superseded";
}

export function categorizeOmrReviewRow(row: OmrReviewRow): OmrReviewCategory {
  if (isArchivedOmrReviewRow(row)) return "archived";
  const status = String(row.status || "").toLowerCase();
  if (status === "failed") return "failed";
  const identifierStatus = String(row.identifier_status || "").toLowerCase();
  if (status === "needs_identification" || identifierStatus === "no_match" || identifierStatus === "missing") {
    return "noid";
  }
  if (row.manual_review_required) return "flag";
  return "ok";
}

export function summarizeOmrReviewRows(rows: OmrReviewRow[]) {
  const counts: Record<OmrReviewFilterKey, number> = {
    all: 0, ok: 0, noid: 0, flag: 0, failed: 0, archived: 0,
  };
  let activeTotal = 0;
  let done = 0;
  for (const row of rows) {
    const category = categorizeOmrReviewRow(row);
    counts.all++;
    counts[category]++;
    if (category !== "archived") activeTotal++;
    if (category === "ok") done++;
  }
  return { counts, activeTotal, done };
}
