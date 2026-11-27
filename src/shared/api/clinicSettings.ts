import api from "@/shared/api/axios";
import type { paths } from "./generated/schema";

export type ClinicColorTuple = [string, string, string];

type SettingsEndpoint = paths["/api/v1/clinic/settings/"];
export type ClinicSettings = SettingsEndpoint["get"]["responses"][200]["content"]["application/json"];
export type ClinicSettingsPatch = NonNullable<SettingsEndpoint["patch"]["requestBody"]>["content"]["application/json"];

export async function fetchClinicSettings() {
  const response = await api.get<ClinicSettings>("/clinic/settings/");
  return response.data;
}

export async function updateClinicSettings(payload: ClinicSettingsPatch) {
  const response = await api.patch<SettingsEndpoint["patch"]["responses"][200]["content"]["application/json"]>(
    "/clinic/settings/", payload,
  );
  return response.data;
}
