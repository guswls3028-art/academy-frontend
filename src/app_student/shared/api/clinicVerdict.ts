import { isApiError } from "@/shared/api/axios";

export type ClinicIdcardResult = "SUCCESS" | "FAIL";
export type ClinicPasscardState = "PASSED" | "CLINIC_REQUIRED" | "BOOKING_CONFIRMED";

class InvalidClinicVerdictError extends Error {}

export function decodeClinicVerdict(value: unknown): {
  current_result: ClinicIdcardResult;
  passcard_state: ClinicPasscardState;
} {
  if (value == null || typeof value !== "object") throw new InvalidClinicVerdictError("Invalid clinic verdict");
  const { current_result, passcard_state } = value as { current_result?: unknown; passcard_state?: unknown };
  if (current_result !== "SUCCESS" && current_result !== "FAIL") {
    throw new InvalidClinicVerdictError("Invalid clinic result");
  }
  const state = passcard_state === "RETURN_ALLOWED" ? "BOOKING_CONFIRMED" : passcard_state;
  if (state !== "PASSED" && state !== "CLINIC_REQUIRED" && state !== "BOOKING_CONFIRMED") {
    throw new InvalidClinicVerdictError("Invalid clinic passcard state");
  }
  return { current_result, passcard_state: state };
}

export function hasNoActiveClinicEnrollment(error: unknown): boolean {
  return isApiError(error) && error.response?.status === 403
    && (error.response.data as { code?: unknown } | null)?.code === "clinic_no_active_enrollment";
}

export function retryClinicVerdict(failureCount: number, error: unknown): boolean {
  return !hasNoActiveClinicEnrollment(error) && !(error instanceof InvalidClinicVerdictError) && failureCount < 1;
}
