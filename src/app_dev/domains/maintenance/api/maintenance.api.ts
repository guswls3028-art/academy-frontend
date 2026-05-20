import api from "@/shared/api/axios";

export type MaintenanceModeDto = {
  enabledForAll: boolean;
  enabledCount: number;
  total: number;
};

type MaintenanceModeResponse = {
  enabled_for_all?: unknown;
  enabled_count?: unknown;
  total?: unknown;
};

function toDto(data: MaintenanceModeResponse): MaintenanceModeDto {
  return {
    enabledForAll: Boolean(data?.enabled_for_all),
    enabledCount: Number(data?.enabled_count ?? 0),
    total: Number(data?.total ?? 0),
  };
}

export async function getMaintenanceMode(): Promise<MaintenanceModeDto> {
  const res = await api.get<MaintenanceModeResponse>("/core/maintenance-mode/");
  return toDto(res.data);
}

export async function setMaintenanceMode(enabled: boolean): Promise<MaintenanceModeDto> {
  const res = await api.patch<MaintenanceModeResponse>("/core/maintenance-mode/", { enabled });
  return toDto(res.data);
}
