import type { TenantRole } from "@/auth/context/AuthContext";

// Match the server permission for manual and scheduled Alimtalk.
export function canSendManualAlimtalk(role: TenantRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "teacher";
}
