// PATH: src/app_admin/domains/messages/hooks/useMessagingInfo.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMessagingInfo,
  testCredentials,
  updateTenantMessagingActivation,
} from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";

export function useMessagingInfo() {
  const q = useQuery({
    queryKey: messageQueryKeys.info,
    queryFn: fetchMessagingInfo,
    staleTime: 60 * 1000,
  });
  return q;
}

export function useTenantMessagingActivation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTenantMessagingActivation,
    onSuccess: (data) => {
      qc.setQueryData(messageQueryKeys.info, data);
    },
  });
}

/** 공급자 연동 테스트 */
export function useTestCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => testCredentials(),
    onSuccess: () => qc.invalidateQueries({ queryKey: messageQueryKeys.info }),
    onError: () => {
      import("@/shared/ui/feedback/feedback").then(({ feedback }) =>
        feedback.error("연동 테스트에 실패했습니다.")
      );
    },
  });
}
