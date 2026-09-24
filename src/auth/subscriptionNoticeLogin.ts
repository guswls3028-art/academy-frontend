import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";

// Deliberately volatile: restoring a tab, reloading, and rotating tokens are not
// logins. Only the successful credential-login path may create this invitation.
let pendingLogin: { generation: string; tenantCode: string } | null = null;

export function markSubscriptionNoticeLogin(generation: string, tenantCode: string | null | undefined) {
  pendingLogin = tenantCode ? { generation, tenantCode } : null;
}

export function readSubscriptionNoticeLogin(tenantCode: string): string | null {
  return pendingLogin?.tenantCode === tenantCode
    && pendingLogin.generation === readActiveAuthGenerationSafely()
    ? pendingLogin.generation
    : null;
}

export function consumeSubscriptionNoticeLogin(generation: string) {
  if (pendingLogin?.generation === generation) pendingLogin = null;
}
