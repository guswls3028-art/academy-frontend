import {
  backupAuthSessionForImpersonation,
  discardImpersonationAuthBackup,
  getImpersonationAuthLabel,
  hasImpersonationAuthBackup,
  publishLoginTokenEnvelope,
  restoreImpersonationAuthSession,
} from "@/shared/auth/tokenSession";

/** 임퍼소네이션 시작 직전에 호출. 현재 dev generation envelope를 보존한다. */
export function beginImpersonation(label: string): void {
  backupAuthSessionForImpersonation(label);
}

/** 서버가 발급한 임퍼소네이션 pair를 새 account generation으로 활성화한다. */
export async function activateImpersonation(access: string, refresh: string): Promise<void> {
  await publishLoginTokenEnvelope(access, refresh);
}

/** 임퍼소네이션이 실제로 시작되지 않았을 때(에러) 보존본 폐기. */
export function abortImpersonation(): void {
  discardImpersonationAuthBackup();
}

/** 복귀: 보존된 dev generation envelope를 복원하고 dev 화면으로 이동한다. */
export async function endImpersonation(): Promise<void> {
  if (await restoreImpersonationAuthSession()) {
    window.location.assign("/dev/dashboard");
  }
}

export function isImpersonating(): boolean {
  return hasImpersonationAuthBackup();
}

export function getImpersonationLabel(): string {
  return getImpersonationAuthLabel();
}
