import { requireLocalItem, requireRemoveLocalItem, requireSetLocalItem } from "@/shared/utils/safeLocalStorage";

const STORAGE_KEY = "hakwonplus:ppt-job-recovery:v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_JOBS = 10;

export type PptJobReference = {
  jobId: string;
  tenantScope: string;
  userId: string;
  label: string;
  createdAt: number;
};

export type PptRecoveryIssue = "scope_changed" | "expired" | "invalid" | "storage_unavailable" | null;

function parseReference(value: unknown): PptJobReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.jobId !== "string" || !/^[\w-]{1,64}$/.test(item.jobId)
    || typeof item.tenantScope !== "string" || !item.tenantScope
    || typeof item.userId !== "string" || !item.userId
    || typeof item.label !== "string" || !item.label
    || typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt)
  ) return null;
  return {
    jobId: item.jobId,
    tenantScope: item.tenantScope,
    userId: item.userId,
    label: item.label.slice(0, 100),
    createdAt: item.createdAt,
  };
}

function readReferences(): { references: PptJobReference[]; invalid: boolean } {
  const raw = requireLocalItem(STORAGE_KEY);
  if (!raw) return { references: [], invalid: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { references: [], invalid: true };
    const references = parsed.slice(0, MAX_JOBS).map(parseReference).filter((item): item is PptJobReference => item !== null);
    const allowedFields = new Set(["jobId", "tenantScope", "userId", "label", "createdAt"]);
    const hasUnexpectedField = parsed.some((value) => value && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).some((field) => !allowedFields.has(field)));
    return { references, invalid: references.length !== parsed.length || hasUnexpectedField };
  } catch {
    return { references: [], invalid: true };
  }
}

function writeReferences(references: PptJobReference[]): void {
  if (references.length) {
    requireSetLocalItem(STORAGE_KEY, JSON.stringify(references.slice(0, MAX_JOBS)));
  } else {
    requireRemoveLocalItem(STORAGE_KEY);
  }
}

export function loadPptJobReferences(tenantScope: string, userId: string): {
  references: PptJobReference[];
  issue: PptRecoveryIssue;
} {
  if (!tenantScope || !userId) return { references: [], issue: "scope_changed" };
  try {
    const { references, invalid } = readReferences();
    if (references.some((item) => item.tenantScope !== tenantScope || item.userId !== userId)) {
      writeReferences([]);
      return { references: [], issue: "scope_changed" };
    }
    const now = Date.now();
    const current = references.filter((item) => item.createdAt <= now + 60_000 && now - item.createdAt < MAX_AGE_MS);
    if (current.length !== references.length || invalid) writeReferences(current);
    return {
      references: current,
      issue: invalid ? "invalid" : current.length !== references.length ? "expired" : null,
    };
  } catch {
    return { references: [], issue: "storage_unavailable" };
  }
}

export function rememberPptJobReference(reference: PptJobReference): boolean {
  const item = parseReference(reference);
  if (!item) return false;
  try {
    const { references } = loadPptJobReferences(item.tenantScope, item.userId);
    writeReferences([item, ...references.filter((other) => other.jobId !== item.jobId)]);
    return true;
  } catch {
    return false;
  }
}

export function forgetPptJobReference(jobId: string): void {
  try {
    const { references } = readReferences();
    writeReferences(references.filter((item) => item.jobId !== jobId));
  } catch {
    // A blocked store contains no recoverable job in this browser session.
  }
}

export function clearPptJobReferences(): void {
  try {
    requireRemoveLocalItem(STORAGE_KEY);
  } catch {
    // Logout still clears active auth; blocked storage is inaccessible.
  }
}
