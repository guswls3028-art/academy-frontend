import api from "@/shared/api/axios";

export type MaintenanceModeState = {
  enabledForAll: boolean;
  enabledCount: number;
  total: number;
};

type MaintenanceModePayload = {
  enabled_for_all?: unknown;
  enabled_count?: unknown;
  total?: unknown;
};

function toState(data: MaintenanceModePayload): MaintenanceModeState {
  return {
    enabledForAll: Boolean(data?.enabled_for_all),
    enabledCount: Number(data?.enabled_count ?? 0),
    total: Number(data?.total ?? 0),
  };
}

export async function getMaintenanceMode(): Promise<MaintenanceModeState> {
  const res = await api.get<MaintenanceModePayload>("/core/maintenance-mode/");
  return toState(res.data);
}

export async function setMaintenanceMode(enabled: boolean): Promise<MaintenanceModeState> {
  const res = await api.patch<MaintenanceModePayload>("/core/maintenance-mode/", { enabled });
  return toState(res.data);
}
