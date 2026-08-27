import { useCallback, useEffect, useRef, useState } from "react";

import {
  requireLocalItem,
  requireRemoveLocalItem,
  requireSetLocalItem,
} from "@/shared/utils/safeLocalStorage";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 800;
const DEFAULT_MAX_WAIT_MS = 5_000;
const DRAFT_VERSION = 1;

export type DurableDraftStatus = "idle" | "saving" | "saved" | "restored" | "error";

type StoredDraft<T> = {
  data: T;
  savedAt: number;
};

type UseDurableDraftOptions<T> = {
  storageKey: string | null;
  value: T;
  isEmpty: (value: T) => boolean;
  isValid: (value: unknown) => value is T;
  onRestore: (value: T) => void;
  debounceMs?: number;
  maxWaitMs?: number;
  ttlMs?: number;
};

type DurableDraftResult<T> = {
  status: DurableDraftStatus;
  savedAt: number | null;
  errorMessage: string | null;
  pendingDraft: StoredDraft<T> | null;
  newerDraft: StoredDraft<T> | null;
  restorePendingDraft: () => void;
  discardPendingDraft: () => void;
  acceptNewerDraft: () => void;
  keepCurrentDraft: () => void;
  clearDraft: () => void;
  markSubmitted: () => void;
  flush: () => void;
  retrySave: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredDraft<T>(
  raw: string,
  isValid: (value: unknown) => value is T,
  ttlMs: number,
): StoredDraft<T> | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return null;

  const savedAt = Number(parsed.savedAt);
  if (parsed.version !== DRAFT_VERSION || !("data" in parsed)) return null;

  if (!Number.isFinite(savedAt) || savedAt <= 0 || Date.now() - savedAt > ttlMs) return null;
  return isValid(parsed.data) ? { data: parsed.data, savedAt } : null;
}

export function useDurableDraft<T>({
  storageKey,
  value,
  isEmpty,
  isValid,
  onRestore,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  ttlMs = DEFAULT_TTL_MS,
}: UseDurableDraftOptions<T>): DurableDraftResult<T> {
  const [status, setStatus] = useState<DurableDraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<T> | null>(null);
  const [newerDraft, setNewerDraft] = useState<StoredDraft<T> | null>(null);
  const [ready, setReady] = useState(false);

  const storageKeyRef = useRef(storageKey);
  const valueRef = useRef(value);
  const isEmptyRef = useRef(isEmpty);
  const isValidRef = useRef(isValid);
  const onRestoreRef = useRef(onRestore);
  const ttlRef = useRef(ttlMs);
  const debounceTimerRef = useRef<number | null>(null);
  const maxWaitTimerRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const lastSeenSavedAtRef = useRef(0);
  const hydratingRef = useRef(false);
  const suppressFlushRef = useRef(false);
  const conflictRef = useRef(false);

  storageKeyRef.current = storageKey;
  valueRef.current = value;
  isEmptyRef.current = isEmpty;
  isValidRef.current = isValid;
  onRestoreRef.current = onRestore;
  ttlRef.current = ttlMs;
  readyRef.current = ready;

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current != null) {
      window.clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
  }, []);

  const failStorage = useCallback(() => {
    setStatus("error");
    setErrorMessage("초안을 저장하지 못했습니다. 입력은 유지됩니다. 저장소를 확인한 뒤 다시 저장해 주세요.");
  }, []);

  const writeValue = useCallback((nextValue: T, force = false) => {
    const key = storageKeyRef.current;
    if (!key || !readyRef.current || (conflictRef.current && !force)) return;
    clearTimers();
    try {
      if (isEmptyRef.current(nextValue)) {
        requireRemoveLocalItem(key);
        lastSeenSavedAtRef.current = 0;
        setSavedAt(null);
        setStatus("idle");
        setErrorMessage(null);
        return;
      }
      const nextSavedAt = Date.now();
      const serialized = JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: nextSavedAt,
        data: nextValue,
      });
      requireSetLocalItem(key, serialized);
      if (requireLocalItem(key) !== serialized) throw new Error("Draft storage readback failed");
      lastSeenSavedAtRef.current = nextSavedAt;
      setSavedAt(nextSavedAt);
      setStatus("saved");
      setErrorMessage(null);
    } catch {
      failStorage();
    }
  }, [clearTimers, failStorage]);

  const flush = useCallback(() => {
    clearTimers();
    if (!suppressFlushRef.current && !conflictRef.current) writeValue(valueRef.current);
  }, [clearTimers, writeValue]);

  useEffect(() => {
    storageKeyRef.current = storageKey;
    setReady(false);
    readyRef.current = false;
    setPendingDraft(null);
    setNewerDraft(null);
    setStatus("idle");
    setSavedAt(null);
    setErrorMessage(null);
    lastSeenSavedAtRef.current = 0;
    hydratingRef.current = false;
    suppressFlushRef.current = false;
    conflictRef.current = false;
    clearTimers();

    if (!storageKey) {
      setReady(true);
      readyRef.current = true;
      return;
    }

    try {
      const raw = requireLocalItem(storageKey);
      if (!raw) {
        setReady(true);
        readyRef.current = true;
        return;
      }
      const stored = readStoredDraft(raw, isValidRef.current, ttlRef.current);
      if (!stored) {
        requireRemoveLocalItem(storageKey);
        setReady(true);
        readyRef.current = true;
        return;
      }
      lastSeenSavedAtRef.current = stored.savedAt;
      setSavedAt(stored.savedAt);
      setPendingDraft(stored);
    } catch {
      setReady(true);
      readyRef.current = true;
      failStorage();
    }
  }, [clearTimers, failStorage, storageKey]);

  const restoreDraft = useCallback((stored: StoredDraft<T> | null) => {
    if (!stored) return;
    hydratingRef.current = true;
    conflictRef.current = false;
    lastSeenSavedAtRef.current = stored.savedAt;
    onRestoreRef.current(stored.data);
    setSavedAt(stored.savedAt);
    setStatus("restored");
    setErrorMessage(null);
    setReady(true);
    readyRef.current = true;
  }, []);

  const restorePendingDraft = useCallback(() => {
    restoreDraft(pendingDraft);
    setPendingDraft(null);
  }, [pendingDraft, restoreDraft]);

  const discardPendingDraft = useCallback(() => {
    const key = storageKeyRef.current;
    clearTimers();
    try {
      if (key) requireRemoveLocalItem(key);
      lastSeenSavedAtRef.current = 0;
      setPendingDraft(null);
      setSavedAt(null);
      setStatus("idle");
      setErrorMessage(null);
      setReady(true);
      readyRef.current = true;
      conflictRef.current = false;
    } catch {
      setPendingDraft(null);
      setReady(true);
      readyRef.current = true;
      failStorage();
    }
  }, [clearTimers, failStorage]);

  const acceptNewerDraft = useCallback(() => {
    conflictRef.current = false;
    restoreDraft(newerDraft);
    setNewerDraft(null);
  }, [newerDraft, restoreDraft]);

  const keepCurrentDraft = useCallback(() => {
    conflictRef.current = false;
    setNewerDraft(null);
    writeValue(valueRef.current, true);
  }, [writeValue]);

  const clearDraft = useCallback(() => {
    const key = storageKeyRef.current;
    clearTimers();
    conflictRef.current = false;
    try {
      if (key) requireRemoveLocalItem(key);
      lastSeenSavedAtRef.current = 0;
      setSavedAt(null);
      setPendingDraft(null);
      setNewerDraft(null);
      setStatus("idle");
      setErrorMessage(null);
    } catch {
      failStorage();
    }
  }, [clearTimers, failStorage]);

  const markSubmitted = useCallback(() => {
    suppressFlushRef.current = true;
    clearDraft();
  }, [clearDraft]);

  const retrySave = useCallback(() => {
    if (conflictRef.current) return;
    setStatus("saving");
    setErrorMessage(null);
    writeValue(valueRef.current, true);
  }, [writeValue]);

  const serializedValue = JSON.stringify(value);
  useEffect(() => {
    if (!storageKey || !ready) return;
    if (hydratingRef.current) {
      hydratingRef.current = false;
      return;
    }
    suppressFlushRef.current = false;
    if (conflictRef.current) return;
    if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current);
    if (isEmptyRef.current(valueRef.current) && lastSeenSavedAtRef.current === 0) {
      clearTimers();
      setStatus("idle");
      return;
    }
    setStatus("saving");
    setErrorMessage(null);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      writeValue(valueRef.current);
    }, debounceMs);
    if (maxWaitTimerRef.current == null) {
      maxWaitTimerRef.current = window.setTimeout(() => {
        maxWaitTimerRef.current = null;
        writeValue(valueRef.current);
      }, maxWaitMs);
    }
    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [clearTimers, debounceMs, maxWaitMs, ready, serializedValue, storageKey, writeValue]);

  useEffect(() => {
    const onPageHide = () => flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const incoming = readStoredDraft(event.newValue, isValidRef.current, ttlRef.current);
        if (!incoming || incoming.savedAt < lastSeenSavedAtRef.current) return;
        if (JSON.stringify(incoming.data) === JSON.stringify(valueRef.current)) {
          lastSeenSavedAtRef.current = incoming.savedAt;
          setSavedAt(incoming.savedAt);
          setStatus("saved");
          setErrorMessage(null);
          return;
        }
        clearTimers();
        conflictRef.current = true;
        setNewerDraft(incoming);
      } catch {
        // 다른 탭의 손상된 값은 현재 입력을 덮어쓰지 않는다.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearTimers, storageKey]);

  return {
    status,
    savedAt,
    errorMessage,
    pendingDraft,
    newerDraft,
    restorePendingDraft,
    discardPendingDraft,
    acceptNewerDraft,
    keepCurrentDraft,
    clearDraft,
    markSubmitted,
    flush,
    retrySave,
  };
}
