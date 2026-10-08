import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMemo, type ClientStudent } from "../api/students.api";
import { adminStudentsQueryKeys } from "../queryKeys";
import { lectureMemoQueryKeys } from "@/shared/api/queryKeys/lectureMemos";
import { feedback } from "@/shared/ui/feedback/feedback";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";

const MEMO_DRAFTS = ["student-memo-drafts"] as const;

/** Keep the local draft while an earlier save/refetch finishes; serialize writes. */
export function useStudentMemo(studentId: number, student?: ClientStudent) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const draftScope = getTenantUserLocalKey(`student-memo:${studentId}`, user?.id);
  const draftKey = [...MEMO_DRAFTS, draftScope] as const;
  const [draft, setDraft] = useState<string | null>(() => draftScope ? qc.getQueryData<string>(draftKey) ?? null : null);
  const draftRef = useRef<string | null>(draft);
  const pending = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const queryKey = adminStudentsQueryKeys.studentDetail(studentId);
  const { mutateAsync } = useMutation({
    scope: { id: `student-memo-${studentId}` },
    mutationFn: (value: string) => createMemo(studentId, value),
  });

  const change = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    // Session-only draft follows the existing tenant/auth query-cache lifecycle.
    // Browser Back or a failed save is recoverable when this student reopens.
    if (draftScope) qc.setQueryData(draftKey, value);
    if (!pending.current) setStatus("idle");
  };

  const save = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    const run = async () => {
      try {
        while (draftRef.current !== null) {
          const snapshot = draftRef.current;
          const current = qc.getQueryData<ClientStudent>(adminStudentsQueryKeys.studentDetail(studentId));
          if (snapshot !== (current?.memo ?? "")) {
            setStatus("saving");
            const saved = await mutateAsync(snapshot);
            await qc.cancelQueries({ queryKey: adminStudentsQueryKeys.studentDetail(studentId), exact: true });
            qc.setQueryData<ClientStudent>(adminStudentsQueryKeys.studentDetail(studentId), (previous) =>
              previous ? { ...previous, memo: saved } : previous,
            );
          }
          if (draftRef.current === snapshot) {
            draftRef.current = null;
            setDraft(null);
            const key = [...MEMO_DRAFTS, draftScope];
            if (draftScope && qc.getQueryData(key) === snapshot) qc.removeQueries({ queryKey: key, exact: true });
          }
        }
        setStatus("saved");
        void Promise.all([
          qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.studentDetail(studentId), exact: true }),
          qc.invalidateQueries({ queryKey: adminStudentsQueryKeys.students }),
          ...lectureMemoQueryKeys.rosters.map((key) => qc.invalidateQueries({ queryKey: key })),
        ]);
        return true;
      } catch {
        setStatus("error");
        feedback.error("메모를 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 저장해 주세요.");
        return false;
      } finally {
        pending.current = null;
      }
    };
    if (draftRef.current === null) return Promise.resolve(true);
    pending.current = Promise.resolve().then(run);
    return pending.current;
  }, [qc, studentId, mutateAsync, draftScope]);

  useEffect(() => {
    qc.setQueryDefaults(MEMO_DRAFTS, { gcTime: Infinity });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (draftRef.current === null && !pending.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [qc]);

  return { value: draft ?? student?.memo ?? "", change, save, status,
    dirty: draft !== null && draft !== (qc.getQueryData<ClientStudent>(queryKey)?.memo ?? student?.memo ?? "") };
}
