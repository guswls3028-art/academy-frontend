// PATH: src/app_admin/domains/messages/hooks/useAutoSendConfig.ts
// 자동발송 설정 조회 + 개별 트리거 토글을 위한 공용 훅

import { useQuery } from "@tanstack/react-query";
import {
  fetchAutoSendConfigs,
  type AutoSendConfigItem,
} from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";
import { useAutoSendDraft } from "./useAutoSendDraft";

/**
 * 자동발송 설정을 조회하고, 특정 trigger의 enabled 변경을 공유 저장 대기열에 넣는다.
 */
export function useAutoSendConfig() {
  const { data: serverConfigs = [], isLoading, isError, refetch } = useQuery({
    queryKey: messageQueryKeys.autoSend,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30_000,
  });

  const { localConfigs: configs, saving, error, edit, retry } = useAutoSendDraft(serverConfigs);

  const getConfig = (trigger: string): AutoSendConfigItem | undefined =>
    configs.find((c) => c.trigger === trigger);

  return {
    configs,
    isLoading,
    getConfig,
    toggleEnabled: (args: { trigger: string; enabled: boolean }) => edit([args]),
    isToggling: saving,
    isError,
    refetch,
    saveError: error,
    retrySave: retry,
  };
}
