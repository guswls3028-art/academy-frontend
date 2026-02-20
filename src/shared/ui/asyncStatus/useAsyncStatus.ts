// PATH: src/shared/ui/asyncStatus/useAsyncStatus.ts
// 현재 테넌트(도메인)에 해당하는 작업만 반환 — 다른 태넌트 탭/전환 시 격리
import { useEffect, useState } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { useProgram } from "@/shared/program";
import { asyncStatusStore, type AsyncTask } from "./asyncStatusStore";

export function useAsyncStatus(): AsyncTask[] {
  const [state, setState] = useState<AsyncTask[]>(() => asyncStatusStore.getState());
  const { program } = useProgram();

  useEffect(() => {
    return asyncStatusStore.subscribe(setState);
  }, []);

  // ProgramContext 우선 (테넌트 전환 시 즉시 반영), 없으면 getTenantCodeForApiRequest
  const currentTenant = (program?.tenantCode ?? getTenantCodeForApiRequest() ?? "") || "";
  // 테넌트별 완전 격리: 현재 테넌트와 tenantScope가 일치하는 작업만 표시
  return state.filter((t) => {
    const scope = t.tenantScope ?? "";
    return scope === currentTenant;
  });
}

export { asyncStatusStore };
