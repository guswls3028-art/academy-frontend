// PATH: src/app_admin/domains/clinic/api/clinicSettings.api.ts
import api from "@/shared/api/axios";

export type ClinicSettings = {
  colors: [string, string, string];
  use_daily_random?: boolean;
  auto_approve_booking?: boolean;
  multi_slot_booking_default?: boolean;
  booking_mode: "fixed_slot" | "time_range";
  booking_interval_minutes: 30 | 60;
  booking_max_stay_minutes: number;
  capabilities: {
    student_operations: { read: boolean; write: boolean };
    student_contacts: { read: boolean; write: boolean };
    booking_policy: { read: boolean; write: boolean };
  };
  saved_colors?: [string, string, string];
};

export type ClinicBookingPolicy = Pick<
  ClinicSettings,
  "booking_mode" | "booking_interval_minutes" | "booking_max_stay_minutes"
>;

const DEFAULT_CAPABILITIES: ClinicSettings["capabilities"] = {
  student_operations: { read: false, write: false },
  student_contacts: { read: false, write: false },
  booking_policy: { read: false, write: false },
};

function normalizeSettings(data: Record<string, unknown>): ClinicSettings {
  const colors = Array.isArray(data.colors) ? data.colors : ["#ef4444", "#3b82f6", "#22c55e"];
  const capabilities = data.capabilities && typeof data.capabilities === "object"
    ? data.capabilities as ClinicSettings["capabilities"]
    : DEFAULT_CAPABILITIES;
  return {
    colors: [String(colors[0] || "#ef4444"), String(colors[1] || "#3b82f6"), String(colors[2] || "#22c55e")],
    use_daily_random: data.use_daily_random === true,
    auto_approve_booking: data.auto_approve_booking === true,
    multi_slot_booking_default: data.multi_slot_booking_default === true,
    booking_mode: data.booking_mode === "time_range" ? "time_range" : "fixed_slot",
    booking_interval_minutes: data.booking_interval_minutes === 30 ? 30 : 60,
    booking_max_stay_minutes: Number(data.booking_max_stay_minutes) || 240,
    capabilities,
    saved_colors: Array.isArray(data.saved_colors)
      ? [String(data.saved_colors[0]), String(data.saved_colors[1]), String(data.saved_colors[2])]
      : undefined,
  };
}

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const res = await api.get("/clinic/settings/");
  return normalizeSettings(res.data ?? {});
}

export async function updateClinicSettings(
  colors?: [string, string, string],
  use_daily_random?: boolean,
  auto_approve_booking?: boolean,
  bookingPolicy?: ClinicBookingPolicy,
): Promise<ClinicSettings> {
  const payload: {
    colors?: [string, string, string];
    use_daily_random?: boolean;
    auto_approve_booking?: boolean;
    booking_mode?: "fixed_slot" | "time_range";
    booking_interval_minutes?: 30 | 60;
    booking_max_stay_minutes?: number;
  } = {};
  if (colors !== undefined) payload.colors = colors;
  if (use_daily_random !== undefined) payload.use_daily_random = use_daily_random;
  if (auto_approve_booking !== undefined) payload.auto_approve_booking = auto_approve_booking;
  if (bookingPolicy) Object.assign(payload, bookingPolicy);
  const res = await api.patch("/clinic/settings/", payload);
  return normalizeSettings(res.data ?? {});
}
