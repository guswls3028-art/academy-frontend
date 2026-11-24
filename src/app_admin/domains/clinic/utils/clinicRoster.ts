import type { ClinicParticipant } from "../api/clinicParticipants.api";

export function isActiveRosterParticipant(participant: ClinicParticipant): boolean {
  return participant.status !== "cancelled" && participant.status !== "rejected";
}

export function participantStudentKey(participant: ClinicParticipant): string {
  return Number.isInteger(participant.student) && participant.student > 0
    ? `student:${participant.student}`
    : `participant:${participant.id}`;
}

export function countStudents(participants: ClinicParticipant[]): number {
  return new Set(participants.map(participantStudentKey)).size;
}
