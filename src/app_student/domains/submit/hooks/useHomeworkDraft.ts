import { useCallback, useEffect, useRef, useState } from "react";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { loadHomeworkDraft, saveHomeworkDraft, type HomeworkDraftFile } from "@/shared/storage/homeworkDraftStorage";

export type PendingMedia = HomeworkDraftFile & {
  status: "queued" | "uploading" | "saving" | "failed";
  progress: number;
  error: string | null;
};
type DraftStatus = "loading" | "saving" | "saved" | "unavailable";
type DraftState = { key: string | null; files: PendingMedia[]; status: DraftStatus };
const EMPTY: PendingMedia[] = [];

export function useHomeworkDraft(target: { id: number; enrollmentId: number } | null, userId: number | undefined) {
  const generation = readAuthTokenEnvelopeSafely()?.generation ?? null;
  const tenant = getTenantCodeForApiRequest();
  const key = target && generation && tenant && userId
    ? JSON.stringify([generation, tenant, userId, target.id, target.enrollmentId]) : null;
  const [state, setState] = useState<DraftState>({ key: null, files: EMPTY, status: "loading" });
  const current = useRef(state);
  current.current = state;
  const activeKey = useRef(key);
  activeKey.current = key;
  const restoration = useRef<{ key: string | null; active: boolean; ready: Promise<boolean> } | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    let finish!: (ready: boolean) => void;
    const scope = { key, active: true, ready: new Promise<boolean>((resolve) => { finish = resolve; }) };
    restoration.current = scope;
    revision.current += 1;
    const publish = (next: DraftState) => {
      current.current = next;
      setState(next);
      if (next.status !== "loading") finish(true);
    };
    if (!key || !generation) publish({ key, files: EMPTY, status: "unavailable" });
    else {
      publish({ key, files: EMPTY, status: "loading" });
      void loadHomeworkDraft(key, generation, () => readAuthTokenEnvelopeSafely()?.generation === generation).then(({ files, persisted }) => {
        if (scope.active && activeKey.current === key && readAuthTokenEnvelopeSafely()?.generation === generation) publish({ key, files: files.map((item) => ({ ...item, status: "queued", progress: 0, error: null })), status: persisted ? "saved" : "unavailable" });
        else finish(false);
      }, () => {
        if (scope.active && activeKey.current === key && readAuthTokenEnvelopeSafely()?.generation === generation) publish({ key, files: EMPTY, status: "unavailable" });
        else finish(false);
      });
    }
    return () => { scope.active = false; finish(false); };
  }, [key, generation]);

  // A file picker can return while restore is pending. Keep the incoming Files
  // in the caller until the original draft is available, then allocate positions
  // against both sets. Scope changes release waiters without transferring files.
  const awaitRestoredFiles = useCallback(async () => {
    const scope = restoration.current;
    if (!scope || scope.key !== key || !(await scope.ready)) return null;
    if (!scope.active || restoration.current !== scope || activeKey.current !== key
      || (readAuthTokenEnvelopeSafely()?.generation ?? null) !== generation || current.current.key !== key) return null;
    return current.current.files;
  }, [key, generation]);

  const setFiles = useCallback((update: PendingMedia[] | ((files: PendingMedia[]) => PendingMedia[])) => {
    if (!restoration.current?.active || activeKey.current !== key || (generation && readAuthTokenEnvelopeSafely()?.generation !== generation)) return;
    const previous = current.current.key === key ? current.current : { key, files: EMPTY, status: "unavailable" as const };
    const files = typeof update === "function" ? update(previous.files) : update;
    const changed = files.length !== previous.files.length || files.some((item, index) => (
      item.clientFileId !== previous.files[index]?.clientFileId || item.position !== previous.files[index]?.position
    ));
    const next = { key, files, status: changed && key ? "saving" as const : previous.status };
    current.current = next;
    setState(next);
    if (!changed || !key || !generation) return;
    const savedRevision = ++revision.current;
    const retained = new Set(files.map((item) => item.clientFileId));
    const previousIds = new Set(previous.files.map((item) => item.clientFileId));
    const addedIds = files.filter((item) => !previousIds.has(item.clientFileId)).map((item) => item.clientFileId);
    const removedIds = previous.files.filter((item) => !retained.has(item.clientFileId)).map((item) => item.clientFileId);
    void saveHomeworkDraft(key, generation, files.map(({ clientFileId, uploadBatchId, file, position }) => ({ clientFileId, uploadBatchId, file, position })), removedIds, () => readAuthTokenEnvelopeSafely()?.generation === generation, addedIds)
      .then(() => finish("saved"), () => finish("unavailable"));
    function finish(status: DraftStatus) {
      if (revision.current !== savedRevision || current.current.key !== key) return;
      setState((value) => ({ ...value, status }));
    }
  }, [key, generation]);

  return { files: state.key === key ? state.files : EMPTY, setFiles, awaitRestoredFiles, draftStatus: state.key === key ? state.status : "loading" as const };
}
