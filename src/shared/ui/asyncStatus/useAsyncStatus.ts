// PATH: src/shared/ui/asyncStatus/useAsyncStatus.ts
// 현재 테넌트(도메인)에 해당하는 작업만 반환 — 다른 태넌트 탭/전환 시 격리
import { useEffect, useState } from "react";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { asyncStatusStore, type AsyncTask } from "./asyncStatusStore";

export function useAsyncStatus(): AsyncTask[] {
  const [state, setState] = useState<AsyncTask[]>(() => asyncStatusStore.getState());

  useEffect(() => {
    return asyncStatusStore.subscribe(setState);
  }, []);

  const currentTenant = getTenantCodeForApiRequest() ?? "";
  return state.filter((t) => (t.tenantScope ?? "") === currentTenant);
}

export { asyncStatusStore };
