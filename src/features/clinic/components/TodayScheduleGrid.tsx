import { ClinicParticipant } from "../api/clinicParticipants.api";
import { buildTimeSlots } from "../utils/timeSlots";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

export default function TodayScheduleGrid({
  rows,
}: {
  rows: ClinicParticipant[];
}) {
  const slots = buildTimeSlots();

  return (
    <div className="grid grid-cols-4 gap-3">
      {slots.map((t) => {
        const items = rows.filter(
          (r) => (r.session_start_time || "").slice(0, 5) === t
        );

        return (
          <div
            key={t}
            className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-3"
          >
            <div className="text-xs font-semibold mb-2">{t}</div>

            {items.length === 0 && (
              <div className="text-[11px] text-[var(--text-muted)]">
                예약 없음
              </div>
            )}

            <div className="space-y-1">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-2 py-1"
                >
                  <div className="text-xs font-semibold">
                    <StudentNameWithLectureChip
                      name={r.student_name}
                      lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                      clinicHighlight={r.name_highlight_clinic_target}
                      profilePhotoUrl={r.profile_photo_url}
                      avatarSize={16}
                      chipSize={12}
                    />
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {r.session_location}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
