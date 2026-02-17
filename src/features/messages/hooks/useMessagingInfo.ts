// PATH: src/features/messages/hooks/useMessagingInfo.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMessagingInfo,
  chargeCredits,
  updateKakaoPfid,
  updateMessagingInfo,
  type TenantMessagingInfo,
} from "../api/messages.api";

const KEY = ["messaging", "info"] as const;

/** 백엔드 미구현 시 UI 확인용 목 데이터 */
const MOCK_INFO: TenantMessagingInfo = {
  kakao_pfid: null,
  messaging_sender: null,
  credit_balance: "0",
  is_active: false,
  base_price: "8.5",
};

export function useMessagingInfo() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        return await fetchMessagingInfo();
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 404) return MOCK_INFO;
        throw e;
      }
    },
    staleTime: 60 * 1000,
  });
  return q;
}

export function useChargeCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: string) => chargeCredits(amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateKakaoPfid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pfid: string) => updateKakaoPfid(pfid),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** 메시징 설정 수정 (발신번호, PFID 등) */
export function useUpdateMessagingInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<Pick<TenantMessagingInfo, "kakao_pfid" | "messaging_sender">>
    ) => updateMessagingInfo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
