import type { User } from "@/auth/context/AuthContext";
import type { Program } from "@/shared/program";
import { getTenantIdFromCode } from "@/shared/tenant";

export function canViewAgentSessions(user: User | null, program: Program | null): boolean {
  return !!user && !!program && program.isPlatformAdmin === true
    && getTenantIdFromCode(program.tenantCode) === 1
    && ["admin97", "t1_admin97"].includes(user.username)
    && (user.is_superuser || user.tenantRole === "owner");
}
