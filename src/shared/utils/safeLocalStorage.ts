import { getTenantCodeForApiRequest } from "@/shared/tenant";

export const AUTH_TOKEN_STORAGE_ERROR_MESSAGE =
  "이 브라우저에 로그인 정보를 저장하지 못했습니다. Safari의 개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.";

export class AuthTokenStorageError extends Error {
  readonly code: "AUTH_TOKEN_STORAGE_FAILED" | "AUTH_TOKEN_STORAGE_PUBLICATION_UNKNOWN";
  readonly cause?: unknown;

  constructor(options?: {
    cause?: unknown;
    code?: "AUTH_TOKEN_STORAGE_FAILED" | "AUTH_TOKEN_STORAGE_PUBLICATION_UNKNOWN";
  }) {
    super(AUTH_TOKEN_STORAGE_ERROR_MESSAGE);
    this.name = "AuthTokenStorageError";
    this.code = options?.code ?? "AUTH_TOKEN_STORAGE_FAILED";
    this.cause = options?.cause;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function requireLocalStorage(): Storage {
  try {
    const storage = getStorage();
    if (!storage) throw new DOMException("Storage unavailable", "SecurityError");
    return storage;
  } catch (cause) {
    if (cause instanceof AuthTokenStorageError) throw cause;
    throw new AuthTokenStorageError({ cause });
  }
}

export function requireLocalItem(key: string): string | null {
  try {
    return requireLocalStorage().getItem(key);
  } catch (cause) {
    if (cause instanceof AuthTokenStorageError) throw cause;
    throw new AuthTokenStorageError({ cause });
  }
}

export function requireSetLocalItem(key: string, value: string): void {
  try {
    requireLocalStorage().setItem(key, value);
  } catch (cause) {
    if (cause instanceof AuthTokenStorageError) throw cause;
    throw new AuthTokenStorageError({ cause });
  }
}

export function requireRemoveLocalItem(key: string): void {
  try {
    requireLocalStorage().removeItem(key);
  } catch (cause) {
    if (cause instanceof AuthTokenStorageError) throw cause;
    throw new AuthTokenStorageError({ cause });
  }
}

export function getLocalItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setLocalItem(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    // Storage can be blocked or full; preferences must never break the UI.
  }
}

export function removeLocalItem(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Storage cleanup is best effort.
  }
}

function tenantStorageKey(key: string): string | null {
  const tenantCode = getTenantCodeForApiRequest();
  return tenantCode ? `${key}:${tenantCode}` : null;
}

export function getTenantLocalItem(key: string): string | null {
  const scopedKey = tenantStorageKey(key);
  return scopedKey ? getLocalItem(scopedKey) : null;
}

export function setTenantLocalItem(key: string, value: string): void {
  const scopedKey = tenantStorageKey(key);
  if (scopedKey) setLocalItem(scopedKey, value);
}

export function removeTenantLocalItem(key: string): void {
  const scopedKey = tenantStorageKey(key);
  if (scopedKey) removeLocalItem(scopedKey);
}

export function getTenantUserLocalKey(
  key: string,
  userId: string | number | null | undefined,
): string | null {
  const scopedKey = tenantStorageKey(key);
  const normalizedUserId = String(userId ?? "").trim();
  return scopedKey && normalizedUserId
    ? `${scopedKey}:user:${encodeURIComponent(normalizedUserId)}`
    : null;
}

export function getTenantUserLocalItem(
  key: string,
  userId: string | number | null | undefined,
): string | null {
  const scopedKey = getTenantUserLocalKey(key, userId);
  return scopedKey ? getLocalItem(scopedKey) : null;
}

export function setTenantUserLocalItem(
  key: string,
  userId: string | number | null | undefined,
  value: string,
): void {
  const scopedKey = getTenantUserLocalKey(key, userId);
  if (scopedKey) setLocalItem(scopedKey, value);
}

export function removeTenantUserLocalItem(
  key: string,
  userId: string | number | null | undefined,
): void {
  const scopedKey = getTenantUserLocalKey(key, userId);
  if (scopedKey) removeLocalItem(scopedKey);
}
