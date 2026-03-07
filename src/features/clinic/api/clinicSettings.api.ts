// PATH: src/features/clinic/api/clinicSettings.api.ts
import api from "@/shared/api/axios";

export type ClinicSettings = {
  colors: [string, string, string];
  use_daily_random?: boolean;
  auto_approve_booking?: boolean;
  saved_colors?: [string, string, string];
};

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const res = await api.get("/clinic/settings/");
  const colors = res.data?.colors || ["#ef4444", "#3b82f6", "#22c55e"];
  return {
    colors: [colors[0] || "#ef4444", colors[1] || "#3b82f6", colors[2] || "#22c55e"],
    use_daily_random: !!res.data?.use_daily_random,
    auto_approve_booking: !!res.data?.auto_approve_booking,
    saved_colors: res.data?.saved_colors
      ? [res.data.saved_colors[0], res.data.saved_colors[1], res.data.saved_colors[2]]
      : undefined,
  };
}

export async function updateClinicSettings(
  colors?: [string, string, string],
  use_daily_random?: boolean,
  auto_approve_booking?: boolean
): Promise<ClinicSettings> {
  const payload: {
    colors?: [string, string, string];
    use_daily_random?: boolean;
    auto_approve_booking?: boolean;
  } = {};
  if (colors !== undefined) payload.colors = colors;
  if (use_daily_random !== undefined) payload.use_daily_random = use_daily_random;
  if (auto_approve_booking !== undefined) payload.auto_approve_booking = auto_approve_booking;
  const res = await api.patch("/clinic/settings/", payload);
  const c = res.data?.colors || colors || ["#ef4444", "#3b82f6", "#22c55e"];
  return {
    colors: [c[0] || "#ef4444", c[1] || "#3b82f6", c[2] || "#22c55e"],
    use_daily_random: !!res.data?.use_daily_random,
    auto_approve_booking: !!res.data?.auto_approve_booking,
    saved_colors: res.data?.saved_colors
      ? [res.data.saved_colors[0], res.data.saved_colors[1], res.data.saved_colors[2]]
      : undefined,
  };
}
