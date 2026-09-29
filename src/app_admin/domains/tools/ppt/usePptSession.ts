import { createContext, useCallback, useContext, useSyncExternalStore, type SetStateAction } from "react";
import { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import type { PptSettings } from "./api/ppt.api";
import type { ImageItem } from "./components/SortableImageGrid";
import type { PdfCropRegion } from "./manualPdfCrop";

export type InputMode = "image" | "pdf";
export type SortMode = "nameAsc" | "nameDesc" | "oldest" | "newest" | "upload" | "manual";

interface PptDraft {
  mode: InputMode;
  images: ImageItem[];
  pdfFile: File | null;
  pdfWorkflow: "auto" | "manual";
  manualRegions: PdfCropRegion[];
  settings: PptSettings;
  sortMode: SortMode;
  previewIndex: number;
  progressPct: number | null;
  progressLabel: string;
  generating: boolean;
  recoveryNonce: number;
}

function emptyDraft(): PptDraft {
  return {
    mode: "image", images: [], pdfFile: null, pdfWorkflow: "auto", manualRegions: [],
    settings: { aspect_ratio: "16:9", background: "black", fit_mode: "contain", invert: true,
      grayscale: true, auto_enhance: false, brightness: 1.0, contrast: 1.0 },
    sortMode: "nameAsc", previewIndex: 0, progressPct: null, progressLabel: "", generating: false, recoveryNonce: 0,
  };
}

export function createSession(tenant: string | null, generation: string | null, userId: string | null) {
  let draft = emptyDraft();
  let active = true;
  const listeners = new Set<() => void>();
  const isCurrent = () => active && !!tenant && !!generation && !!userId
    && window.location.pathname.replace(/\/+$/, "") === "/workspace/tools/ppt"
    && getTenantCodeForApiRequest() === tenant
    && readAuthTokenEnvelopeSafely()?.generation === generation;
  const update = <K extends keyof PptDraft>(key: K, action: SetStateAction<PptDraft[K]>) => {
    if (!active) return;
    const value = typeof action === "function"
      ? (action as (previous: PptDraft[K]) => PptDraft[K])(draft[key]) : action;
    if (Object.is(draft[key], value)) return;
    draft = { ...draft, [key]: value };
    listeners.forEach((listener) => listener());
  };
  return {
    snapshot: () => draft,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set: update,
    isCurrent,
    claim() {
      if (!isCurrent() || draft.generating) return false;
      update("generating", true);
      return true;
    },
    requestConfig() {
      if (!isCurrent() || !generation) throw new Error("계정이나 학원이 변경되었습니다. 파일을 다시 선택해주세요.");
      return createAuthSessionBoundConfig(generation, undefined, tenant!);
    },
    activate() { active = true; },
    dispose() {
      active = false;
      draft.images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      draft = emptyDraft();
      listeners.clear();
    },
  };
}

export const PptSessionContext = createContext<ReturnType<typeof createSession> | null>(null);

export function usePptSession() {
  const session = useContext(PptSessionContext);
  if (!session) throw new Error("PPT session provider is required");
  return session;
}

export function usePptDraftState<K extends keyof PptDraft>(key: K): [PptDraft[K], (action: SetStateAction<PptDraft[K]>) => void] {
  const session = usePptSession();
  const draft = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const setValue = useCallback((action: SetStateAction<PptDraft[K]>) => session.set(key, action), [session, key]);
  return [draft[key], setValue];
}
