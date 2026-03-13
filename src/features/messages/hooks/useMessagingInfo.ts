// PATH: src/features/messages/hooks/useMessagingInfo.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMessagingInfo,
  chargeCredits,
  updateKakaoPfid,
  updateMessagingInfo,
  verifySender,
  testCredentials,
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
  sms_allowed: false,
  channel_source: "system_default",
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

/** 메시징 설정 수정 (발신번호, PFID, 공급자, 자체 연동 키 등) */
export function useUpdateMessagingInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<Pick<TenantMessagingInfo, "kakao_pfid" | "messaging_sender" | "messaging_provider">> & {
        own_solapi_api_key?: string;
        own_solapi_api_secret?: string;
        own_ppurio_api_key?: string;
        own_ppurio_account?: string;
      }
    ) => updateMessagingInfo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** 발신번호 솔라피 등록 여부 인증 */
export function useVerifySender() {
  return useMutation({
    mutationFn: (phoneNumber: string) => verifySender(phoneNumber),
  });
}

/** 공급자 연동 테스트 */
export function useTestCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => testCredentials(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
