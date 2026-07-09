import type { APIRequestContext } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || process.env.API_BASE_URL || "https://api.hakwonplus.com";
const PRODUCTION_API_HOST = "api.hakwonplus.com";
const CONTROLLED_PHONE = normalizePhone(process.env.E2E_REAL_ALIMTALK_CONTROLLED_PHONE) || "01031217466";
const GUARD_INSTALLED = Symbol.for("academy.e2e.accountNotificationGuardInstalled");
const controlledStudentUsernames = new Set<string>();

type JsonPayload = Record<string, unknown>;
type GuardedRequest = APIRequestContext & { [GUARD_INSTALLED]?: boolean };
type RequestOptions = {
  data?: unknown;
  method?: string;
};

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function isProductionRequest(url: string): boolean {
  try {
    return new URL(url, API_BASE).hostname.toLowerCase() === PRODUCTION_API_HOST;
  } catch {
    return false;
  }
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url, API_BASE).pathname.replace(/\/+$/, "/");
  } catch {
    return url;
  }
}

function isPlainPayload(value: unknown): value is JsonPayload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function reject(message: string): never {
  throw new Error(`[E2E account-notification safety] ${message}`);
}

function assertNoLegacyOptOut(payload: JsonPayload, endpoint: string): void {
  if (payload.send_welcome_message === false) {
    reject(`${endpoint} uses send_welcome_message=false, but account notices are mandatory now.`);
  }
  if (payload.skip_notify === true) {
    reject(`${endpoint} uses skip_notify=true, but password notices are mandatory now.`);
  }
}

function assertControlledPhone(payload: JsonPayload, key: string, endpoint: string): void {
  const phone = normalizePhone(payload[key]);
  if (!phone) return;
  if (phone !== CONTROLLED_PHONE) {
    reject(`${endpoint} would send an account notice to ${key}=${phone}. Use controlled phone ${CONTROLLED_PHONE}.`);
  }
}

function markControlledStudent(payload: JsonPayload): void {
  const psNumber = String(payload.ps_number ?? payload.student_ps_number ?? "").trim();
  if (!psNumber) return;
  const phones = [
    normalizePhone(payload.parent_phone),
    normalizePhone(payload.phone),
    normalizePhone(payload.student_phone),
  ].filter(Boolean);
  if (phones.length > 0 && phones.every((phone) => phone === CONTROLLED_PHONE)) {
    controlledStudentUsernames.add(psNumber);
  }
}

function assertKnownControlledStudent(payload: JsonPayload, endpoint: string): void {
  const psNumber = String(payload.student_ps_number ?? "").trim();
  if (!psNumber) return;
  if (!controlledStudentUsernames.has(psNumber)) {
    reject(`${endpoint} resets student_ps_number=${psNumber} without a guarded controlled-phone fixture in this worker.`);
  }
}

export function assertAccountNotificationRequestSafe(
  url: string,
  method: string,
  data: unknown,
): void {
  if (!isPlainPayload(data)) return;

  const upperMethod = method.toUpperCase();
  const path = pathFromUrl(url);
  const isStudentCreate = upperMethod === "POST" && /\/api\/v1\/students\/$/.test(path);
  const isPasswordReset = upperMethod === "POST" && /\/api\/v1\/students\/password_reset_send\/$/.test(path);
  const isStudentUpdate = ["PATCH", "PUT"].includes(upperMethod) && /\/api\/v1\/students\/\d+\/$/.test(path);

  if (!isStudentCreate && !isPasswordReset && !isStudentUpdate) return;

  assertNoLegacyOptOut(data, `${upperMethod} ${path}`);
  if (!isProductionRequest(url)) {
    if (isStudentCreate) markControlledStudent(data);
    return;
  }

  if (isStudentCreate) {
    assertControlledPhone(data, "parent_phone", `${upperMethod} ${path}`);
    assertControlledPhone(data, "phone", `${upperMethod} ${path}`);
    assertControlledPhone(data, "student_phone", `${upperMethod} ${path}`);
    markControlledStudent(data);
    return;
  }

  if (isPasswordReset) {
    assertControlledPhone(data, "parent_phone", `${upperMethod} ${path}`);
    assertControlledPhone(data, "student_phone", `${upperMethod} ${path}`);
    assertKnownControlledStudent(data, `${upperMethod} ${path}`);
    return;
  }

  assertControlledPhone(data, "parent_phone", `${upperMethod} ${path}`);
  assertControlledPhone(data, "phone", `${upperMethod} ${path}`);
  assertControlledPhone(data, "student_phone", `${upperMethod} ${path}`);
}

export function installAccountNotificationGuard(request: APIRequestContext): APIRequestContext {
  const guarded = request as GuardedRequest;
  if (guarded[GUARD_INSTALLED]) return request;
  guarded[GUARD_INSTALLED] = true;

  const fetch = request.fetch.bind(request);
  guarded.fetch = ((url: Parameters<APIRequestContext["fetch"]>[0], options?: RequestOptions) => {
    assertAccountNotificationRequestSafe(String(url), options?.method ?? "GET", options?.data);
    return fetch(url, options as Parameters<APIRequestContext["fetch"]>[1]);
  }) as APIRequestContext["fetch"];

  for (const method of ["post", "put", "patch"] as const) {
    const original = request[method].bind(request);
    guarded[method] = ((url: string, options?: RequestOptions) => {
      assertAccountNotificationRequestSafe(String(url), method.toUpperCase(), options?.data);
      return original(url, options as Parameters<APIRequestContext[typeof method]>[1]);
    }) as APIRequestContext[typeof method];
  }

  return request;
}
