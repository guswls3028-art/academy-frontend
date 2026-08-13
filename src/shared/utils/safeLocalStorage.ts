import { getTenantCodeForApiRequest } from "@/shared/tenant";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
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
