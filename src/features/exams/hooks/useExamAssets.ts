/**
 * useExamAssets (ENHANCED)
 *
 * WHY:
 * - 기존 계약 유지: useExamAssets()는 기본적으로 ExamAsset[]를 반환한다.
 * - 단, Batch1의 submissions UX에서 "problem_pdf/omr_sheet 존재 여부"를 직관적으로 쓰기 위해
 *   반환 배열에 보조 프로퍼티(problem_pdf/omr_sheet)를 부착한다 (타입 교란 없이 호환).
 * - 새 endpoint 금지, 기존 fetchExamAssets 그대로 사용.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchExamAssets, ExamAsset } from "../api/assets";

export type ExamAssetsList = ExamAsset[] & {
  /** convenience flags (non-authoritative, UI gate only) */
  problem_pdf?: boolean;
  omr_sheet?: boolean;
};

export function useExamAssets(examId?: number) {
  return useQuery<ExamAssetsList>({
    queryKey: ["exam-assets", examId],
    queryFn: async () => {
      const list = (await fetchExamAssets(examId as number)) as ExamAssetsList;

      // ⚠️ UI 편의용 flag (서버 단일진실 = assets list)
      (list as any).problem_pdf = list.some((a) => a.asset_type === "problem_pdf");
      (list as any).omr_sheet = list.some((a) => a.asset_type === "omr_sheet");

      return list;
    },
    enabled:
      typeof examId === "number" &&
      Number.isFinite(examId) &&
      examId > 0,
  });
}

export function isAssetsReady(assets: ExamAsset[]) {
  const hasPdf = assets.some((a) => a.asset_type === "problem_pdf");
  const hasOmr = assets.some((a) => a.asset_type === "omr_sheet");
  return hasPdf && hasOmr;
}
