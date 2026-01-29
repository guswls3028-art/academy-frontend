// PATH: src/features/homework/hooks/useHomeworkPolicy.ts
/**
 * useHomeworkPolicy (FIX: 현 types.ts 스펙과 일치)
 *
 * ✅ 책임
 * - sessionId 기준 policy 조회
 * - policy PATCH 후 invalidate
 *
 * 🔒 계약
 * - POST 없음 (프론트 생성 금지)
 * - passed 계산 없음 (서버 단일 진실)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchHomeworkPolicyBySession,
  patchHomeworkPolicy,
} from "../api/homeworkPolicy";
import type { HomeworkPolicy } from "../types";

type PatchData = Partial<
  Pick<HomeworkPolicy, "cutline_mode" | "cutline_value" | "round_unit_percent">
>;

export function useHomeworkPolicy(sessionId: number) {
  const qc = useQueryClient();

  const safeSessionId =
    Number.isFinite(sessionId) && sessionId > 0 ? sessionId : 0;

  const q = useQuery({
    queryKey: ["homework-policy", safeSessionId],
    queryFn: () => fetchHomeworkPolicyBySession(safeSessionId),
    enabled: safeSessionId > 0,
  });

  const patchPolicy = useMutation({
    mutationFn: async (payload: { id: number; data: PatchData }) =>
      patchHomeworkPolicy(payload.id, payload.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["homework-policy", safeSessionId] });
    },
  });

  return {
    ...q,
    patchPolicy,
  };
}
