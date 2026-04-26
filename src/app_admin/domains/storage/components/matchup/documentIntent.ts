import type { MatchupDocument } from "../../api/matchup.api";

export type MatchupDocumentIntent = "reference" | "test";

export function getDocumentIntent(doc: MatchupDocument): MatchupDocumentIntent {
  if (doc.meta?.upload_intent === "test") return "test";
  if (doc.meta?.document_role === "exam_sheet") return "test";
  return "reference";
}
