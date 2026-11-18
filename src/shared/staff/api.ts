import { CanceledError, getAdapter, isCancel, type AxiosAdapter } from "axios";
import api, {
  capturePlaybackEventScope as captureRequestScope,
  isPlaybackEventScopeCurrent as isRequestScopeCurrent,
  type ApiRequestConfig,
} from "@/shared/api/axios";

export type AssignedWorkType = {
  id: number;
  name: string;
  hourly_wage: number;
};

export type StaffMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
  is_owner?: boolean;
  owner_display_name?: string | null;
  owner_phone?: string | null;
  staff_id?: number;
  default_work_type_id?: number;
  assigned_work_types?: AssignedWorkType[];
  owner_setup_required?: boolean;
  /** Local result of optional setup; never a replacement for server permissions. */
  ownerSetupError?: "conflict" | "retry";
};

const ownerSetupRequests = new Map<string, Promise<StaffMe>>();
// Axios resolves fetch transport against the per-request env at runtime.
const resolveAdapter: (adapters: Parameters<typeof getAdapter>[0], config: Parameters<AxiosAdapter>[0]) => AxiosAdapter = getAdapter;

/** Canonical tenant-scoped staff identity and work assignments. */
export async function fetchStaffMe(): Promise<StaffMe> {
  // Bind both stages to this login and tenant, without a selected-child header.
  const scope = { ...captureRequestScope(), studentId: null };
  const baseURL = api.defaults.baseURL;
  const transport = api.defaults.adapter;
  // Keep this endpoint-specific fence in the staff chunk. The normal API's
  // captured generation/tenant still govern token refresh and retries.
  const adapter: AxiosAdapter = async config => {
    const current = () => isRequestScopeCurrent(scope);
    if (!current() || config.url !== "/staffs/me/" || config.baseURL !== baseURL
      || !["get", "post"].includes(String(config.method).toLowerCase())
      || config.params != null || (config as ApiRequestConfig).skipAuth) {
      throw new CanceledError("Authentication session changed.");
    }
    try {
      const response = await resolveAdapter(transport, config)(config);
      if (!current()) throw new CanceledError("Authentication session changed.");
      return response;
    } catch (error) {
      if (!current()) throw new CanceledError("Authentication session changed.");
      throw error;
    }
  };
  const continuation: ApiRequestConfig = { adapter,
    _authGeneration: scope.generation ?? undefined,
    _expectedTenant: scope.tenantCode ?? undefined,
    headers: { "X-Student-Id": false },
  };
  const { data } = await api.get<StaffMe>("/staffs/me/", continuation);
  if (!isRequestScopeCurrent(scope)) throw new CanceledError("Authentication session changed.");
  if (data.is_owner !== true || data.owner_setup_required !== true) return data;
  const key = JSON.stringify([scope.tenantCode, scope.generation, scope.supportSessionId]);
  let pending = ownerSetupRequests.get(key);
  if (!pending) {
    pending = api.post<StaffMe>("/staffs/me/", {}, continuation)
      .then(({ data: ready }) => {
        if (!isRequestScopeCurrent(scope)) throw new CanceledError("Authentication session changed.");
        if (ready.is_authenticated !== true || ready.is_owner !== true || ready.owner_setup_required !== false
          || typeof ready.is_superuser !== "boolean" || typeof ready.is_staff !== "boolean"
          || typeof ready.is_payroll_manager !== "boolean"
          || !Number.isSafeInteger(ready.staff_id) || Number(ready.staff_id) <= 0) {
          throw new Error("직원 정보를 준비하지 못했습니다. 다시 시도해 주세요.");
        }
        return ready;
      })
      .catch((error: unknown) => {
        if (isCancel(error) || !isRequestScopeCurrent(scope)) {
          throw new CanceledError("Authentication session changed.");
        }
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) throw error;
        // Identity/permissions were successfully read. An ancillary setup error
        // must remain visible without hiding the existing staff/payroll journey.
        return { ...data, ownerSetupError: status === 409 ? "conflict" as const : "retry" as const };
      })
      .finally(() => {
        if (ownerSetupRequests.get(key) === pending) ownerSetupRequests.delete(key);
      });
    ownerSetupRequests.set(key, pending);
  }
  const ready = await pending;
  if (!isRequestScopeCurrent(scope)) throw new CanceledError("Authentication session changed.");
  return ready;
}
