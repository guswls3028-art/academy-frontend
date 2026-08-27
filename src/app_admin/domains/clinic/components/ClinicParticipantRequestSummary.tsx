import type { ClinicParticipant } from "../api/clinicParticipants.api";
import { hhmmText } from "@/shared/ui/time/timeFormat";

type Props = {
  participant: ClinicParticipant;
};

export default function ClinicParticipantRequestSummary({ participant }: Props) {
  const preferredTime =
    participant.preferred_start_time && participant.preferred_end_time
      ? `${hhmmText(participant.preferred_start_time, "-")}–${hhmmText(participant.preferred_end_time, "-")}`
      : null;

  if (!preferredTime && !participant.memo) return null;

  return (
    <span className="clinic-bookings__pending-request">
      {preferredTime && <strong>희망 {preferredTime}</strong>}
      {participant.memo && <span>{participant.memo}</span>}
    </span>
  );
}
