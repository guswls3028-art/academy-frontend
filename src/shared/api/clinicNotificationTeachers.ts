import { queryOptions } from "@tanstack/react-query";
import api from "./axios";
import { clinicQueryKeys } from "./queryKeys/clinic";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

export function clinicNotificationTeachersQuery() {
  return queryOptions({
    queryKey: clinicQueryKeys.notificationTeachers(getTenantCodeForApiRequest()),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Array<{ id: number; name: string }>>("/clinic/sessions/notification-teachers/", { signal });
      if (!Array.isArray(data)) throw new Error("담당 선생님 목록을 확인해 주세요.");
      return data;
    },
    staleTime: 60_000,
  });
}
