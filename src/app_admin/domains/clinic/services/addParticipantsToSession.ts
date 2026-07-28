import type { ClinicTarget } from "../api/clinicTargets";
import {
  createClinicParticipant,
  type ClinicParticipant,
} from "../api/clinicParticipants.api";
import type { EnrollmentSelection, StudentSelection } from "@/shared/types/selection";
import { buildParticipantPayload } from "../utils/buildParticipantPayload";

export type AddParticipantsResult = {
  requested: number;
  added: number;
  skipped: number;
  failed: number;
};

export async function addParticipantsToSession(input: {
  sessionId: number;
  selection: EnrollmentSelection | StudentSelection;
  currentParticipants: ClinicParticipant[];
  clinicTargets: ClinicTarget[];
}): Promise<AddParticipantsResult> {
  const ids = Array.from(new Set(
    input.selection.kind === "enrollment"
      ? input.selection.enrollmentIds
      : input.selection.studentIds
  ));
  const sessionParticipants = input.currentParticipants.filter(
    (participant) => participant.session === input.sessionId
  );
  const existingEnrollmentIds = new Set(
    sessionParticipants
      .map((participant) => participant.enrollment_id)
      .filter((id): id is number => typeof id === "number")
  );
  const existingStudentIds = new Set(
    sessionParticipants.map((participant) => participant.student)
  );
  const reasonByEnrollment = new Map<number, ClinicTarget["clinic_reason"]>();
  for (const target of input.clinicTargets) {
    if (!reasonByEnrollment.has(target.enrollment_id)) {
      reasonByEnrollment.set(target.enrollment_id, target.clinic_reason);
    }
  }

  const pendingIds = ids.filter((id) =>
    input.selection.kind === "enrollment"
      ? !existingEnrollmentIds.has(id)
      : !existingStudentIds.has(id)
  );
  const results = await Promise.allSettled(
    pendingIds.map((id) =>
      createClinicParticipant(
        buildParticipantPayload(
          input.sessionId,
          id,
          input.selection,
          input.selection.kind === "enrollment" ? reasonByEnrollment.get(id) : undefined
        )
      )
    )
  );
  const failed = results.filter((result) => result.status === "rejected").length;

  return {
    requested: ids.length,
    added: results.length - failed,
    skipped: ids.length - pendingIds.length,
    failed,
  };
}
