import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

const DRAFT_SCHEMA_VERSION = 1;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const SAVE_DELAY_MS = 500;

type StoredAssessmentDraft<TForm> = {
  schemaVersion: number;
  resourceKind: "exam" | "homework";
  resourceId: number;
  baseUpdatedAt: string;
  savedAt: number;
  form: TForm;
};

type RecoverableDraft<TForm> = {
  form: TForm;
  savedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function readDraft<TForm>(key: string): StoredAssessmentDraft<TForm> | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!isRecord(parsed) || !isRecord(parsed.form)) return null;
    if (
      parsed.schemaVersion !== DRAFT_SCHEMA_VERSION ||
      (parsed.resourceKind !== "exam" && parsed.resourceKind !== "homework") ||
      typeof parsed.resourceId !== "number" ||
      typeof parsed.baseUpdatedAt !== "string" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    return parsed as StoredAssessmentDraft<TForm>;
  } catch {
    return null;
  }
}

function removeDraft(key: string | null) {
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

export function useAssessmentPolicyDraft<TForm extends Record<string, unknown>>({
  resourceKind,
  resourceId,
  baseUpdatedAt,
  form,
  dirty,
  onRestore,
}: {
  resourceKind: "exam" | "homework";
  resourceId: number;
  baseUpdatedAt: string;
  form: TForm | null;
  dirty: boolean;
  onRestore: (form: TForm) => void;
}) {
  const { user } = useAuth();
  const tenantCode = getTenantCodeForApiRequest();
  const storageKey = useMemo(() => (
    tenantCode && user?.id
      ? `assessment-policy-draft:v${DRAFT_SCHEMA_VERSION}:${tenantCode}:u${user.id}:${resourceKind}:${resourceId}`
      : null
  ), [resourceId, resourceKind, tenantCode, user?.id]);
  const checkedVersionRef = useRef("");
  const hasStoredDraftRef = useRef(false);
  const [recoverable, setRecoverable] = useState<RecoverableDraft<TForm> | null>(null);

  useEffect(() => {
    if (!storageKey || !baseUpdatedAt || !form) return;
    const checkedVersion = `${storageKey}:${baseUpdatedAt}`;
    if (checkedVersionRef.current === checkedVersion) return;
    checkedVersionRef.current = checkedVersion;

    const stored = readDraft<TForm>(storageKey);
    if (
      !stored ||
      stored.resourceKind !== resourceKind ||
      stored.resourceId !== resourceId ||
      stored.baseUpdatedAt !== baseUpdatedAt ||
      Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS
    ) {
      removeDraft(storageKey);
      hasStoredDraftRef.current = false;
      setRecoverable(null);
      return;
    }
    if (JSON.stringify(stored.form) === JSON.stringify(form)) {
      removeDraft(storageKey);
      hasStoredDraftRef.current = false;
      setRecoverable(null);
      return;
    }
    hasStoredDraftRef.current = true;
    setRecoverable({ form: stored.form, savedAt: stored.savedAt });
  }, [baseUpdatedAt, form, resourceId, resourceKind, storageKey]);

  useEffect(() => {
    if (!storageKey || !baseUpdatedAt || !form) return;
    if (checkedVersionRef.current !== `${storageKey}:${baseUpdatedAt}`) return;
    if (!dirty) {
      if (!recoverable && !hasStoredDraftRef.current) removeDraft(storageKey);
      return;
    }
    if (recoverable) {
      removeDraft(storageKey);
      hasStoredDraftRef.current = false;
      setRecoverable(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const stored: StoredAssessmentDraft<TForm> = {
        schemaVersion: DRAFT_SCHEMA_VERSION,
        resourceKind,
        resourceId,
        baseUpdatedAt,
        savedAt: Date.now(),
        form,
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch {
        // The native unload guard remains active when persistence is unavailable.
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [baseUpdatedAt, dirty, form, recoverable, resourceId, resourceKind, storageKey]);

  const restoreDraft = useCallback(() => {
    if (!recoverable) return;
    onRestore(recoverable.form);
    hasStoredDraftRef.current = false;
    setRecoverable(null);
  }, [onRestore, recoverable]);

  const clearDraft = useCallback(() => {
    removeDraft(storageKey);
    hasStoredDraftRef.current = false;
    setRecoverable(null);
  }, [storageKey]);

  return {
    recoverableDraftSavedAt: recoverable?.savedAt ?? null,
    restoreDraft,
    clearDraft,
  };
}
