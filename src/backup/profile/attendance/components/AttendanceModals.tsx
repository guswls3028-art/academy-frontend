// PATH: src/features/profile/attendance/components/AttendanceModals.tsx
import AttendanceFormModal from "@/features/profile/components/AttendanceFormModal";
import { Attendance } from "@/features/profile/api/profile";

export default function AttendanceModals({
  open,
  editing,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Attendance | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: any) => Promise<void>;
}) {
  return (
    <AttendanceFormModal
      open={open}
      initial={editing}
      submitting={submitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
