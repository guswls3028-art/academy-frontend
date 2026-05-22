// PATH: src/auth/api/recovery.api.ts
import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type AccountRecoveryMode = "username" | "password";
export type AccountRecoveryTarget = "student" | "parent";

const SKIP_AUTH_CONFIG: ApiRequestConfig = { skipAuth: true };

function normalizePhone(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

export async function dispatchAccountRecovery(params: {
  mode: AccountRecoveryMode;
  target: AccountRecoveryTarget;
  studentName: string;
  phone: string;
}): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(
    "/auth/account-recovery/dispatch/",
    {
      mode: params.mode,
      target: params.target,
      student_name: params.studentName.trim(),
      phone: normalizePhone(params.phone),
    },
    SKIP_AUTH_CONFIG,
  );
  return res.data;
}
