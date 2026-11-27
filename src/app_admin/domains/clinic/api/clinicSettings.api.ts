// PATH: src/app_admin/domains/clinic/api/clinicSettings.api.ts
import {
  fetchClinicSettings as fetchSettings,
  updateClinicSettings as patchSettings,
  type ClinicColorTuple,
  type ClinicSettingsPatch,
  type ClinicSettings as SettingsData,
} from "@/shared/api/clinicSettings";

export type ClinicSettings = Omit<SettingsData, "colors" | "saved_colors"> & {
  colors: ClinicColorTuple;
  saved_colors?: ClinicColorTuple;
};

export type ClinicCutoffPolicy = Required<Pick<
  ClinicSettingsPatch,
  "booking_cutoff_mode" | "booking_cutoff_time" | "booking_cutoff_minutes" | "allow_late_requests"
>>;

export type ClinicBookingPolicy = Required<Pick<
  ClinicSettingsPatch,
  "booking_mode" | "booking_interval_minutes" | "booking_max_stay_minutes"
>>;

const DEFAULT_CAPABILITIES: ClinicSettings["capabilities"] = {
  student_operations: { read: false, write: false },
  student_contacts: { read: false, write: false },
  booking_policy: { read: false, write: false },
};

function normalizeSettings(data: Partial<SettingsData>): ClinicSettings {
  const colors = Array.isArray(data.colors) ? data.colors : ["#ef4444", "#3b82f6", "#22c55e"];
  const capabilities = data.capabilities && typeof data.capabilities === "object"
    ? data.capabilities
    : DEFAULT_CAPABILITIES;
  return {
    colors: [String(colors[0] || "#ef4444"), String(colors[1] || "#3b82f6"), String(colors[2] || "#22c55e")],
    use_daily_random: data.use_daily_random === true,
    auto_approve_booking: data.auto_approve_booking === true,
    multi_slot_booking_default: data.multi_slot_booking_default === true,
    booking_mode: data.booking_mode === "time_range" ? "time_range" : "fixed_slot",
    booking_interval_minutes: data.booking_interval_minutes === 30 ? 30 : 60,
    booking_max_stay_minutes: Number(data.booking_max_stay_minutes) || 240,
    booking_cutoff_mode: data.booking_cutoff_mode === "previous_day" || data.booking_cutoff_mode === "before_start" ? data.booking_cutoff_mode : "none",
    booking_cutoff_time: String(data.booking_cutoff_time ?? "21:00").slice(0, 5),
    booking_cutoff_minutes: Number(data.booking_cutoff_minutes) || 120,
    allow_late_requests: data.allow_late_requests === true,
    capabilities,
    saved_colors: Array.isArray(data.saved_colors)
      ? [String(data.saved_colors[0]), String(data.saved_colors[1]), String(data.saved_colors[2])]
      : undefined,
  };
}

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  return normalizeSettings((await fetchSettings()) ?? {});
}

export async function updateClinicSettings(
  colors?: [string, string, string],
  use_daily_random?: boolean,
  auto_approve_booking?: boolean,
  bookingPolicy?: ClinicBookingPolicy | ClinicCutoffPolicy,
): Promise<ClinicSettings> {
  const payload: ClinicSettingsPatch = {};
  if (colors !== undefined) payload.colors = colors;
  if (use_daily_random !== undefined) payload.use_daily_random = use_daily_random;
  if (auto_approve_booking !== undefined) payload.auto_approve_booking = auto_approve_booking;
  if (bookingPolicy) Object.assign(payload, bookingPolicy);
  return normalizeSettings((await patchSettings(payload)) ?? {});
}
