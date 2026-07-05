// PATH: src/shared/hooks/useTenantLabels.ts
// 합격/불합격 라벨 SSOT — 학원장 커스텀 라벨 fetch + fallback.
//
// 정책 (2026-05-12 #5):
//   - backend `Tenant.pass_label` / `fail_label` 가 SSOT
//   - 빈 문자열이면 기본값 "합격" / "불합격"
//   - React Query 캐시 (5분) — 학원장이 settings 페이지에서 수정 시 자동 invalidate
//
// 사용 예:
//   const { pass, fail, isLoading } = useTenantLabels();
//   <Badge>{passed ? pass : fail}</Badge>

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { accountQueryKeys } from "@/shared/api/queryKeys/account";

interface TenantLabelInfo {
  pass_label?: string;
  fail_label?: string;
}

const FALLBACK = {
  pass: "합격",
  fail: "불합격",
};

export interface TenantLabels {
  pass: string;
  fail: string;
  isLoading: boolean;
}

export function useTenantLabels(): TenantLabels {
  const { data, isLoading } = useQuery({
    queryKey: accountQueryKeys.tenantLabels,
    queryFn: async () => {
      const res = await api.get<TenantLabelInfo>("/core/tenant-info/");
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    pass: (data?.pass_label || "").trim() || FALLBACK.pass,
    fail: (data?.fail_label || "").trim() || FALLBACK.fail,
    isLoading,
  };
}

/** 결과(합격/불합격) → 라벨 변환 헬퍼. 비동기 hook 안 쓰는 곳에서 직접 라벨만 받을 때. */
export function resolveResultLabel(passed: boolean, labels: TenantLabels): string {
  return passed ? labels.pass : labels.fail;
}
