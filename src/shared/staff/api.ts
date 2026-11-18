import { CanceledError, isCancel } from "axios";
import api, {
  captureStaffIdentityScope,
  isStaffIdentityScopeCurrent,
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

/** Canonical tenant-scoped staff identity and work assignments. */
export async function fetchStaffMe(): Promise<StaffMe> {
  // Bind both stages to this login and tenant, without a selected-child header.
  const scope = captureStaffIdentityScope();
  const continuation: ApiRequestConfig = { staffIdentityScope: scope };
  const { data } = await api.get<StaffMe>("/staffs/me/", continuation);
  if (data.is_owner !== true || data.owner_setup_required !== true) return data;
  if (!isStaffIdentityScopeCurrent(scope)) throw new CanceledError("직원 정보를 조회하는 계정이 변경되었습니다.");
  const key = JSON.stringify([scope.tenantCode, scope.generation, scope.supportSessionId]);
  let pending = ownerSetupRequests.get(key);
  if (!pending) {
    pending = api.post<StaffMe>("/staffs/me/", {}, continuation)
      .then(({ data: ready }) => {
        if (!isStaffIdentityScopeCurrent(scope)) throw new CanceledError("직원 정보를 조회하는 계정이 변경되었습니다.");
        if (ready.is_owner !== true || ready.owner_setup_required === true
          || !Number.isSafeInteger(ready.staff_id) || Number(ready.staff_id) <= 0) {
          throw new Error("직원 정보를 준비하지 못했습니다. 다시 시도해 주세요.");
        }
        return ready;
      })
      .catch((error: unknown) => {
        if (isCancel(error) || !isStaffIdentityScopeCurrent(scope)) {
          throw new CanceledError("직원 정보를 조회하는 계정이 변경되었습니다.");
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
  return pending;
}
