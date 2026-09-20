import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { useProgram } from "@/shared/program";
import { messageQueryKeys } from "../queryKeys";

/** The sender uses Tenant.name, which can differ from the site's branding name. */
export function useMessageAcademyName(enabled = true) {
  const { program } = useProgram();
  return useQuery({
    queryKey: messageQueryKeys.academyName(program?.tenantCode),
    queryFn: async () => {
      const { data } = await api.get<{ tenant_name: string }>("/core/subscription/");
      if (typeof data.tenant_name !== "string" || !data.tenant_name.trim()) {
        throw new Error("발송 학원명을 확인하지 못했습니다.");
      }
      return data.tenant_name.trim();
    },
    enabled: enabled && Boolean(program?.tenantCode),
    staleTime: 30_000,
    retry: 1,
  });
}
