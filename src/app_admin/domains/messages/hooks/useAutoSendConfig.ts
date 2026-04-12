// PATH: src/app_admin/domains/messages/hooks/useAutoSendConfig.ts
// 자동발송 설정 조회 + 개별 트리거 토글을 위한 공용 훅

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAutoSendConfigs,
  updateAutoSendConfigs,
  type AutoSendConfigItem,
} from "../api/messages.api";
import { feedback } from "@/shared/ui/feedback/feedback";

const QUERY_KEY = ["messaging", "auto-send"] as const;

/**
 * 자동발송 설정을 조회하고, 특정 trigger의 enabled를 토글하는 mutation을 제공한다.
 */
export function useAutoSendConfig() {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAutoSendConfigs,
    staleTime: 30_000,
  });

  const toggleMut = useMutation({
    mutationFn: (args: { trigger: string; enabled: boolean }) => {
      const next = configs.map((c) =>
        c.trigger === args.trigger ? { ...c, enabled: args.enabled } : c,
      );
      return updateAutoSendConfigs(next);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      feedback.success("자동발송 설정이 변경되었습니다.");
    },
    onError: () => {
      feedback.error("자동발송 설정 변경에 실패했습니다.");
    },
  });

  const getConfig = (trigger: string): AutoSendConfigItem | undefined =>
    configs.find((c) => c.trigger === trigger);

  return {
    configs,
    isLoading,
    getConfig,
    toggleEnabled: toggleMut.mutate,
    isToggling: toggleMut.isPending,
  };
}
