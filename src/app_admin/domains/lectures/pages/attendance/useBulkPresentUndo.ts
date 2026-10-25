import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";

type BulkPresentUndo = { token: string; updated: number; expiresAt: number };

function readUndo(key: string): BulkPresentUndo | null {
  try {
    const parsed = JSON.parse(getSessionItem(key) ?? "null") as Partial<BulkPresentUndo> | null;
    if (parsed && typeof parsed.token === "string" && parsed.token.length > 0
      && Number.isInteger(parsed.updated) && Number(parsed.updated) > 0
      && Number.isFinite(parsed.expiresAt) && Number(parsed.expiresAt) > Date.now()) {
      return { token: parsed.token, updated: Number(parsed.updated), expiresAt: Number(parsed.expiresAt) };
    }
  } catch { /* Invalid or unavailable storage must not expose a recovery action. */ }
  removeSessionItem(key);
  return null;
}

export function useBulkPresentUndo(tenantCode: string | null, userId: number | null | undefined, sessionId: number) {
  const key = tenantCode && userId && Number.isInteger(sessionId) && sessionId > 0
    ? `attendance:bulk-present-undo:v1:${encodeURIComponent(tenantCode)}:user:${userId}:session:${sessionId}`
    : null;
  const [state, setState] = useState<{ key: string | null; value: BulkPresentUndo | null }>({ key: null, value: null });
  const currentScope = useRef(key);
  currentScope.current = key;
  const value = state.key === key ? state.value : null;
  const setValue = useCallback((next: BulkPresentUndo | null) => {
    if (!key) return;
    if (next) setSessionItem(key, JSON.stringify(next));
    else removeSessionItem(key);
    // A late response for a previous scope must not replace the visible record.
    if (currentScope.current === key) setState({ key, value: next });
  }, [key]);

  useEffect(() => {
    setState({ key, value: key ? readUndo(key) : null });
  }, [key]);

  useEffect(() => {
    if (!value) return;
    const remaining = value.expiresAt - Date.now();
    if (remaining <= 0) {
      setValue(null);
      return;
    }
    const timer = window.setTimeout(() => setValue(null), remaining);
    return () => window.clearTimeout(timer);
  }, [value, setValue]);

  return [value, setValue] as const;
}
