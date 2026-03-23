import type { EnrollmentSelection, StudentSelection } from "@/shared/types/selection";
import type { ClinicParticipantStatus } from "../api/clinicParticipants.api";

export type ClinicParticipantPayload = {
  session: number;
  enrollment_id?: number;
  student?: number;
  status: ClinicParticipantStatus;
  clinic_reason?: "exam" | "homework" | "both";
};

/**
 * Build participant creation payload from selection result.
 * Eliminates ID domain confusion by dispatching on selection.kind.
 */
export function buildParticipantPayload(
  sessionId: number,
  id: number,
  selection: EnrollmentSelection | StudentSelection,
  reason?: "exam" | "homework" | "both",
): ClinicParticipantPayload {
  const base = {
    session: sessionId,
    status: "booked" as const,
    ...(reason ? { clinic_reason: reason } : {}),
  };

  switch (selection.kind) {
    case "enrollment":
      return { ...base, enrollment_id: id };
    case "student":
      return { ...base, student: id };
  }
}
