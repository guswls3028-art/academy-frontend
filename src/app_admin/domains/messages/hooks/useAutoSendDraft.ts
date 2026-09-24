import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback/feedback";
import { updateAutoSendConfigs, type AutoSendConfigItem } from "../api/messages.api";
import { messageQueryKeys } from "../queryKeys";

type Patch = Partial<AutoSendConfigItem> & Pick<AutoSendConfigItem, "trigger">;
type Snapshot = { patches: Patch[]; saving: boolean; error: string | null };
const EMPTY: Snapshot = { patches: [], saving: false, error: null };

class AutoSendDraft {
  private snapshot: Snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disposed = false;
  private abort: AbortController | null = null;

  constructor(private qc: QueryClient, private tenant: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;

  private publish(next: Snapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  edit = (patches: Partial<AutoSendConfigItem>[], debounce = false) => {
    if (this.disposed) return;
    const merged = new Map(this.snapshot.patches.map((patch) => [patch.trigger, patch]));
    for (const patch of patches) {
      if (patch.trigger) merged.set(patch.trigger, { ...merged.get(patch.trigger), ...patch, trigger: patch.trigger });
    }
    this.publish({ patches: [...merged.values()], saving: this.snapshot.saving, error: null });
    this.schedule(debounce ? 600 : 0);
  };

  retry = () => {
    if (this.snapshot.patches.length) {
      this.publish({ ...this.snapshot, error: null });
      this.schedule(0);
    }
  };

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.running || this.disposed || !this.snapshot.patches.length) return;
    if (getTenantCodeForApiRequest() !== this.tenant) { this.dispose(); return; }
    this.running = true;
    const sent = this.snapshot.patches;
    this.abort = new AbortController();
    this.publish({ ...this.snapshot, saving: true });
    try {
      await this.qc.cancelQueries({ queryKey: messageQueryKeys.autoSend });
      if (this.disposed || getTenantCodeForApiRequest() !== this.tenant) { this.dispose(); return; }
      const saved = await updateAutoSendConfigs(sent, this.abort.signal);
      if (this.disposed || getTenantCodeForApiRequest() !== this.tenant) { this.dispose(); return; }
      // Only remove fields that still equal the submitted values. Edits made during
      // the request remain pending and are sent after this response.
      const remaining = this.snapshot.patches.flatMap((current) => {
        const submitted = sent.find((item) => item.trigger === current.trigger);
        if (!submitted) return [current];
        const rest: Patch = { trigger: current.trigger };
        for (const key of Object.keys(current) as (keyof AutoSendConfigItem)[]) {
          if (key !== "trigger" && current[key] !== submitted[key]) {
            Object.assign(rest, { [key]: current[key] });
          }
        }
        return Object.keys(rest).length > 1 ? [rest] : [];
      });
      // PATCH returns persisted rows only; GET also includes virtual rows for
      // triggers that have not been configured yet.
      this.qc.setQueryData<AutoSendConfigItem[]>(messageQueryKeys.autoSend, (previous = []) => {
        const byTrigger = new Map(previous.map((config) => [config.trigger, config]));
        saved.forEach((config) => byTrigger.set(config.trigger, config));
        return [...byTrigger.values()];
      });
      this.publish({ patches: remaining, saving: false, error: null });
      if (!remaining.length) feedback.success("자동발송 설정이 저장되었습니다.");
    } catch (err: unknown) {
      if (this.disposed) return;
      const detail = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null;
      this.publish({ ...this.snapshot, saving: false, error: detail || "저장에 실패했습니다. 변경 내용을 유지했습니다." });
    } finally {
      this.running = false;
      this.abort = null;
      if (!this.disposed && !this.snapshot.error && this.snapshot.patches.length && !this.timer) {
        this.schedule(0);
      }
    }
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.abort?.abort();
    this.publish(EMPTY);
    this.listeners.clear();
  }
}

const drafts = new Map<QueryClient, Map<string, AutoSendDraft>>();

export function clearAutoSendDrafts(qc: QueryClient) {
  drafts.get(qc)?.forEach((draft) => draft.dispose());
  drafts.delete(qc);
}

export function useAutoSendDraft(configs: AutoSendConfigItem[]) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const tenant = getTenantCodeForApiRequest();
  const scope = tenant && user?.id ? `${tenant}:${user.id}` : null;
  const draft = useMemo(() => {
    if (!scope || !tenant) return null;
    let byScope = drafts.get(qc);
    if (!byScope) { byScope = new Map(); drafts.set(qc, byScope); }
    let current = byScope.get(scope);
    if (!current) { current = new AutoSendDraft(qc, tenant); byScope.set(scope, current); }
    return current;
  }, [qc, scope, tenant]);
  useEffect(() => {
    if (!scope) { clearAutoSendDrafts(qc); return; }
    const byScope = drafts.get(qc);
    byScope?.forEach((oldDraft, oldScope) => {
      if (oldScope !== scope) { oldDraft.dispose(); byScope.delete(oldScope); }
    });
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
