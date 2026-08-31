import type { ClinicSessionUpdateNotice } from "./clinicScheduleConfirmation";

type ClinicSessionFormSource = {
  title?: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  location: string;
  max_participants: number;
  target_grade?: number | null;
  target_school_type?: string | null;
  target_lecture_ids?: number[];
  section?: number | null;
  allow_time_preference?: boolean;
  allow_multi_slot_booking?: boolean;
};

export type ClinicCreatePanelProps = {
  date?: string;
  hideDatePicker?: boolean;
  selectedTargetEnrollmentIds?: number[];
  onChangeSelectedTargetEnrollmentIds?: (ids: number[]) => void;
  onDateChange?: (date: string) => void;
  onCreated?: (createdDate?: string) => void;
  /** When true, renders as a flat form (no card shell) — use inside AdminModal */
  asModal?: boolean;
  /** Edit mode: pass existing session to pre-fill form */
  editSession?: ClinicSessionFormSource & { id: number };
  /** Copy mode: pre-fill settings from an existing session while creating a new session */
  copySession?: ClinicSessionFormSource;
  onUpdated?: (notice: ClinicSessionUpdateNotice) => void;
  onPendingChange?: (pending: boolean) => void;
};
