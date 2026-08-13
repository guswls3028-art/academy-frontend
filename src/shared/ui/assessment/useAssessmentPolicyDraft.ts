import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import {
  getLocalItem,
  getTenantUserLocalKey,
  removeLocalItem,
  setLocalItem,
} from "@/shared/utils/safeLocalStorage";

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
    const parsed: unknown = JSON.parse(getLocalItem(key) ?? "null");
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
  removeLocalItem(key);
}

function readDraftWithMigration<TForm>(
  storageKey: string,
  previousStorageKey: string | null,
): StoredAssessmentDraft<TForm> | null {
  const current = readDraft<TForm>(storageKey);
  if (current || !previousStorageKey) return current;
  const previous = readDraft<TForm>(previousStorageKey);
  if (!previous) return null;
  setLocalItem(storageKey, JSON.stringify(previous));
  if (readDraft<TForm>(storageKey)) removeLocalItem(previousStorageKey);
  return previous;
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
  const storageKey = useMemo(() => {
    if (!tenantCode) return null;
    return getTenantUserLocalKey(
      `assessment-policy-draft:v${DRAFT_SCHEMA_VERSION}:${resourceKind}:${resourceId}`,
      user?.id,
    );
  }, [resourceId, resourceKind, tenantCode, user?.id]);
  const previousStorageKey = useMemo(() => (
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

    const stored = readDraftWithMigration<TForm>(storageKey, previousStorageKey);
    if (
      !stored ||
      stored.resourceKind !== resourceKind ||
      stored.resourceId !== resourceId ||
      stored.baseUpdatedAt !== baseUpdatedAt ||
      Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS
    ) {
      removeDraft(storageKey);
      removeDraft(previousStorageKey);
      hasStoredDraftRef.current = false;
      setRecoverable(null);
      return;
    }
    if (JSON.stringify(stored.form) === JSON.stringify(form)) {
      removeDraft(storageKey);
      removeDraft(previousStorageKey);
      hasStoredDraftRef.current = false;
      setRecoverable(null);
      return;
    }
    hasStoredDraftRef.current = true;
    setRecoverable({ form: stored.form, savedAt: stored.savedAt });
  }, [baseUpdatedAt, form, previousStorageKey, resourceId, resourceKind, storageKey]);

  useEffect(() => {
    if (!storageKey || !baseUpdatedAt || !form) return;
    if (checkedVersionRef.current !== `${storageKey}:${baseUpdatedAt}`) return;
    if (!dirty) {
      if (!recoverable && !hasStoredDraftRef.current) {
        removeDraft(storageKey);
        removeDraft(previousStorageKey);
      }
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
      setLocalItem(storageKey, JSON.stringify(stored));
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [baseUpdatedAt, dirty, form, previousStorageKey, recoverable, resourceId, resourceKind, storageKey]);

  const restoreDraft = useCallback(() => {
    if (!recoverable) return;
    onRestore(recoverable.form);
    hasStoredDraftRef.current = false;
    setRecoverable(null);
  }, [onRestore, recoverable]);

  const clearDraft = useCallback(() => {
    removeDraft(storageKey);
    removeDraft(previousStorageKey);
    hasStoredDraftRef.current = false;
    setRecoverable(null);
  }, [previousStorageKey, storageKey]);

  return {
    recoverableDraftSavedAt: recoverable?.savedAt ?? null,
    restoreDraft,
    clearDraft,
  };
}
