import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback/feedback";
import { updateAutoSendConfigs, type AutoSendConfigItem } from "../api/messages.api";
import {
  clearAutoSendDrafts,
  clearOtherAutoSendDrafts,
  getAutoSendDraft,
} from "./autoSendDraftStore";

const EMPTY = { patches: [], saving: false, error: null };

export function useAutoSendDraft(configs: AutoSendConfigItem[]) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const tenant = getTenantCodeForApiRequest();
  const generation = readActiveAuthGenerationSafely();
  const owner = tenant && generation ? `${tenant}:${generation}` : null;
  const scope = owner && user?.id ? `${owner}:${user.id}` : null;
  const draft = useMemo(() => {
    if (!scope || !owner || !generation) return null;
    return getAutoSendDraft(
      qc, scope, owner,
      (patches, signal) => updateAutoSendConfigs(patches, signal, generation),
      () => {
        const currentTenant = getTenantCodeForApiRequest();
        const currentGeneration = readActiveAuthGenerationSafely();
        return currentTenant && currentGeneration ? `${currentTenant}:${currentGeneration}` : null;
      },
      () => feedback.success("자동발송 설정이 저장되었습니다."),
    );
  }, [qc, scope, owner, generation]);
  useEffect(() => {
    if (!scope) { clearAutoSendDrafts(qc); return; }
    clearOtherAutoSendDrafts(qc, scope);
  }, [qc, scope]);
  const snapshot = useSyncExternalStore(draft?.subscribe ?? (() => () => {}), draft?.getSnapshot ?? (() => EMPTY));
  const localConfigs = useMemo(() => configs.map((config) => ({
    ...config,
    ...snapshot.patches.find((patch) => patch.trigger === config.trigger),
  })), [configs, snapshot]);
  return {
    localConfigs,
    saving: snapshot.saving,
    error: snapshot.error,
    edit: draft?.edit ?? (() => {}),
    retry: draft?.retry ?? (() => {}),
  };
}
