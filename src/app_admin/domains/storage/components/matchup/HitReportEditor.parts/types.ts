// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.parts/types.ts
// HitReportEditor 전용 타입/상수 SSOT.
// 적중 분류 임계값은 backend pdf_report.py SIM_* 와 동일해야 한다 (PDF 출력 일관성).

import type { HitReportCandidate, HitReportSelectedMeta } from "../../../api/matchup.api";

// 적중 분류 — pdf_report.py와 동일 임계값 (직접/유형/개념/없음)
export const SIM_DIRECT = 0.85;
export const SIM_TYPE = 0.75;
export const SIM_CONCEPT = 0.60;

export type Tier = "direct" | "type" | "concept" | "miss";

export function classifyMatch(sim: number): Tier {
  if (sim >= SIM_DIRECT) return "direct";
  if (sim >= SIM_TYPE) return "type";
  if (sim >= SIM_CONCEPT) return "concept";
  return "miss";
}

export const TIER_COLOR: Record<Tier, string> = {
  direct: "#16A34A",   // green-600
  type: "#0891B2",     // cyan-600
  concept: "#7C3AED",  // violet-600
  miss: "#94A3B8",     // slate-400
};
export const TIER_BG: Record<Tier, string> = {
  direct: "#DCFCE7",
  type: "#CFFAFE",
  concept: "#EDE9FE",
  miss: "#F1F5F9",
};
export const TIER_LABEL: Record<Tier, string> = {
  direct: "직접 적중",
  type: "유형 적중",
  concept: "개념 커버",
  miss: "유사 자료 없음",
};

export const SOURCE_PANE_COLOR = "#D97706";  // amber-600 — 시험지(원본)
export const SOURCE_PANE_BG = "#FEF3C7";     // amber-100

export type CandidateMeta = HitReportCandidate | HitReportSelectedMeta;
