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
const EMPTY: PendingMedia[] = [];

export function useHomeworkDraft(target: { id: number; enrollmentId: number } | null, userId: number | undefined) {
  const generation = readAuthTokenEnvelopeSafely()?.generation ?? null;
  const tenant = getTenantCodeForApiRequest();
  const key = target && generation && tenant && userId
    ? JSON.stringify([generation, tenant, userId, target.id, target.enrollmentId]) : null;
  const [state, setState] = useState<{ key: string | null; files: PendingMedia[]; status: DraftStatus }>({ key: null, files: EMPTY, status: "loading" });
  const current = useRef(state);
  current.current = state;
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    revision.current += 1;
    if (!key || !generation) { setState({ key, files: EMPTY, status: "unavailable" }); return; }
    setState({ key, files: EMPTY, status: "loading" });
    void loadHomeworkDraft(key, generation, () => readAuthTokenEnvelopeSafely()?.generation === generation).then(({ files, persisted }) => {
      if (active && readAuthTokenEnvelopeSafely()?.generation === generation) setState({ key, files: files.map((item) => ({ ...item, status: "queued", progress: 0, error: null })), status: persisted ? "saved" : "unavailable" });
    }, () => { if (active) setState({ key, files: EMPTY, status: "unavailable" }); });
    return () => { active = false; };
  }, [key, generation]);

  const setFiles = useCallback((update: PendingMedia[] | ((files: PendingMedia[]) => PendingMedia[])) => {
    if (generation && readAuthTokenEnvelopeSafely()?.generation !== generation) return;
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

  return { files: state.key === key ? state.files : EMPTY, setFiles, draftStatus: state.key === key ? state.status : "loading" as const };
}
