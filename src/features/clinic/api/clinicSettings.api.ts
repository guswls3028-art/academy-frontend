// PATH: src/features/clinic/api/clinicSettings.api.ts
import api from "@/shared/api/axios";

export type ClinicSettings = {
  colors: [string, string, string];
};

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const res = await api.get("/clinic/settings/");
  const colors = res.data?.colors || ["#ef4444", "#3b82f6", "#22c55e"];
  return {
    colors: [colors[0] || "#ef4444", colors[1] || "#3b82f6", colors[2] || "#22c55e"],
  };
}

export async function updateClinicSettings(colors: [string, string, string]): Promise<ClinicSettings> {
  const res = await api.patch("/clinic/settings/", { colors });
  const updatedColors = res.data?.colors || colors;
  return {
    colors: [updatedColors[0] || colors[0], updatedColors[1] || colors[1], updatedColors[2] || colors[2]],
  };
}
