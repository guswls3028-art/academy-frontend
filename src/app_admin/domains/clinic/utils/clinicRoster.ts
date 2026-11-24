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

export type ClinicSessionRosterCounts = {
  total: number;
  booked: number;
  pending: number;
  processed: number;
};

export function countActiveStudentsBySession(activeRows: ClinicParticipant[]) {
  const sessions = new Map<number, ClinicParticipant[]>();
  for (const row of activeRows) {
    const existing = sessions.get(row.session);
    if (existing) existing.push(row);
    else sessions.set(row.session, [row]);
  }

  const counts = new Map<number, ClinicSessionRosterCounts>();
  for (const [id, students] of sessions) {
    counts.set(id, {
      total: countStudents(students),
      booked: countStudents(students.filter((row) => row.status === "booked")),
      pending: countStudents(students.filter((row) => row.status === "pending")),
      processed: countStudents(students.filter((row) => row.status === "attended" || row.status === "no_show")),
    });
  }
  return counts;
}
