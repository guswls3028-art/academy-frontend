import {
  AUTH_TOKEN_STORAGE_ERROR_MESSAGE,
  AuthTokenStorageError,
  requireLocalItem,
  requireRemoveLocalItem,
  requireSetLocalItem,
} from "@/shared/utils/safeLocalStorage";

export { AUTH_TOKEN_STORAGE_ERROR_MESSAGE, AuthTokenStorageError };

export const AUTH_ACTIVE_GENERATION_KEY = "academy:auth-active-generation:v1";
export const AUTH_TOKEN_STORAGE_ERROR_EVENT = "academy-auth-token-storage-error";

export const AUTH_TOKEN_GENERATION_PREFIX = "academy:auth-tokens:v1:";
const AUTH_IMPERSONATION_BACKUP_KEY = "academy:auth-impersonation-backup:v1";
const LEGACY_ACCESS_KEY = "access";
const LEGACY_REFRESH_KEY = "refresh";
const AUTH_SESSION_LOCK_NAME = "academy-auth-session";

export type AuthTokenEnvelope = {
  access: string;
  refresh: string;
  generation: string;
};

type ImpersonationBackup = {
  session: AuthTokenEnvelope;
  label: string;
};

function createGeneration(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const entropy = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
    ? crypto.getRandomValues(new Uint32Array(4)).join("-")
    : `${Date.now()}-${Math.random()}`;
  return `auth-${entropy}`;
}

function generationKey(generation: string): string {
  return `${AUTH_TOKEN_GENERATION_PREFIX}${generation}`;
}

function parseEnvelope(raw: string | null, expectedGeneration?: string): AuthTokenEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthTokenEnvelope>;
    const access = String(parsed.access || "").trim();
    const refresh = String(parsed.refresh || "").trim();
    const generation = String(parsed.generation || "").trim();
    if (!access || !refresh || !generation) return null;
    if (expectedGeneration && generation !== expectedGeneration) return null;
    return { access, refresh, generation };
  } catch {
    return null;
  }
}

function readGenerationEnvelope(generation: string): AuthTokenEnvelope | null {
  return parseEnvelope(requireLocalItem(generationKey(generation)), generation);
}

function writeGenerationEnvelope(envelope: AuthTokenEnvelope): AuthTokenEnvelope {
  const key = generationKey(envelope.generation);
  const serialized = JSON.stringify(envelope);
  requireSetLocalItem(key, serialized);
  if (requireLocalItem(key) !== serialized) throw new AuthTokenStorageError();
  return envelope;
}

function activateEnvelope(envelope: AuthTokenEnvelope): AuthTokenEnvelope {
  const previousGeneration = String(requireLocalItem(AUTH_ACTIVE_GENERATION_KEY) || "").trim();
  writeGenerationEnvelope(envelope);
  try {
    requireSetLocalItem(AUTH_ACTIVE_GENERATION_KEY, envelope.generation);
  } catch (error) {
    try { requireRemoveLocalItem(generationKey(envelope.generation)); } catch { /* orphan is inactive */ }
    throw error;
  }
  let publishedGeneration: string | null;
  try {
    publishedGeneration = requireLocalItem(AUTH_ACTIVE_GENERATION_KEY);
  } catch (cause) {
    // The pointer set completed, but Safari denied the verification read. Its
    // publication state is unknown: preserving both pointer and candidate is
    // the only no-lock-safe result. A conditional pointer restore could race
    // with and overwrite a newer account login.
    throw new AuthTokenStorageError({
      cause,
      code: "AUTH_TOKEN_STORAGE_PUBLICATION_UNKNOWN",
    });
  }
  if (publishedGeneration !== envelope.generation) {
    try { requireRemoveLocalItem(generationKey(envelope.generation)); } catch { /* inactive cleanup */ }
    throw new AuthTokenStorageError();
  }
  if (previousGeneration && previousGeneration !== envelope.generation) {
    try { requireRemoveLocalItem(generationKey(previousGeneration)); } catch { /* inactive cleanup is best effort */ }
  }
  return envelope;
}

function migrateLegacyEnvelope(): AuthTokenEnvelope | null {
  const access = String(requireLocalItem(LEGACY_ACCESS_KEY) || "").trim();
  const refresh = String(requireLocalItem(LEGACY_REFRESH_KEY) || "").trim();
  if (!access || !refresh) return null;
  const migrated = activateEnvelope({ access, refresh, generation: createGeneration() });
  try { requireRemoveLocalItem(LEGACY_ACCESS_KEY); } catch { /* generation envelope is authoritative */ }
  try { requireRemoveLocalItem(LEGACY_REFRESH_KEY); } catch { /* generation envelope is authoritative */ }
  return migrated;
}

export function readAuthTokenEnvelope(): AuthTokenEnvelope | null {
  const generation = String(requireLocalItem(AUTH_ACTIVE_GENERATION_KEY) || "").trim();
  if (!generation) return migrateLegacyEnvelope();
  return readGenerationEnvelope(generation);
}

export function readAuthTokenEnvelopeSafely(): AuthTokenEnvelope | null {
  try {
    return readAuthTokenEnvelope();
  } catch {
    return null;
  }
}

export function authGenerationFromStorageValue(raw: string | null): string | null {
  return String(raw || "").trim() || null;
}

export function readActiveAuthGenerationSafely(): string | null {
  try {
    return authGenerationFromStorageValue(requireLocalItem(AUTH_ACTIVE_GENERATION_KEY));
  } catch {
    return null;
  }
}

export function authGenerationFromEnvelopeStorageKey(key: string | null): string | null {
  if (!key?.startsWith(AUTH_TOKEN_GENERATION_PREFIX)) return null;
  return String(key.slice(AUTH_TOKEN_GENERATION_PREFIX.length)).trim() || null;
}

export async function withAuthSessionLock<T>(callback: () => Promise<T> | T): Promise<T> {
  const lockManager = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!lockManager) return callback();
  return lockManager.request(AUTH_SESSION_LOCK_NAME, callback).then((result) => result);
}

export async function publishLoginTokenEnvelope(
  access: string,
  refresh: string,
): Promise<AuthTokenEnvelope> {
  return withAuthSessionLock(() => activateEnvelope({
    access,
    refresh,
    generation: createGeneration(),
  }));
}

/** Must be called inside the shared auth-session lock held across refresh. */
export function publishRefreshedTokenEnvelope(
  expectedGeneration: string,
  expectedRefresh: string,
  access: string,
  refresh: string,
): AuthTokenEnvelope | null {
  if (requireLocalItem(AUTH_ACTIVE_GENERATION_KEY) !== expectedGeneration) return null;
  const current = readGenerationEnvelope(expectedGeneration);
  if (!current || current.refresh !== expectedRefresh) return null;
  const next = writeGenerationEnvelope({ access, refresh, generation: expectedGeneration });
  if (requireLocalItem(AUTH_ACTIVE_GENERATION_KEY) !== expectedGeneration) {
    try { requireRemoveLocalItem(generationKey(expectedGeneration)); } catch { /* inactive orphan */ }
    return null;
  }
  return next;
}

/**
 * Expiry/logout removes only the caller's generation envelope. The active
 * pointer is intentionally never removed: a no-lock account switch can update
 * it between check and cleanup, and deleting that shared pointer would log out
 * the newer account.
 */
export function clearAuthTokenEnvelope(expectedGeneration?: string | null): void {
  const generation = expectedGeneration
    ?? String(requireLocalItem(AUTH_ACTIVE_GENERATION_KEY) || "").trim();
  if (generation) requireRemoveLocalItem(generationKey(generation));
  try { requireRemoveLocalItem(LEGACY_ACCESS_KEY); } catch { /* legacy cleanup */ }
  try { requireRemoveLocalItem(LEGACY_REFRESH_KEY); } catch { /* legacy cleanup */ }
}

export function backupAuthSessionForImpersonation(label: string): void {
  const session = readAuthTokenEnvelope();
  if (!session) throw new AuthTokenStorageError();
  requireSetLocalItem(AUTH_IMPERSONATION_BACKUP_KEY, JSON.stringify({ session, label }));
}

function readImpersonationBackup(): ImpersonationBackup | null {
  try {
    const raw = requireLocalItem(AUTH_IMPERSONATION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ImpersonationBackup>;
    const session = parseEnvelope(JSON.stringify(parsed.session ?? null));
    return session ? { session, label: String(parsed.label || "") } : null;
  } catch {
    return null;
  }
}

export async function restoreImpersonationAuthSession(): Promise<boolean> {
  const backup = readImpersonationBackup();
  if (!backup) return false;
  await publishLoginTokenEnvelope(backup.session.access, backup.session.refresh);
  requireRemoveLocalItem(AUTH_IMPERSONATION_BACKUP_KEY);
  return true;
}

export function discardImpersonationAuthBackup(): void {
  try { requireRemoveLocalItem(AUTH_IMPERSONATION_BACKUP_KEY); } catch { /* best effort */ }
}

export function hasImpersonationAuthBackup(): boolean {
  return readImpersonationBackup() !== null;
}

export function getImpersonationAuthLabel(): string {
  return readImpersonationBackup()?.label ?? "";
}

export function notifyAuthTokenStorageError(error: AuthTokenStorageError): void {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_STORAGE_ERROR_EVENT, {
      detail: { message: error.message },
    }));
  } catch {
    // The typed error still reaches the caller when the UI event is unavailable.
  }
}
