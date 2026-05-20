export const ORIG_LABEL = "dev_orig_label";

const ORIG_ACCESS = "dev_orig_access";
const ORIG_REFRESH = "dev_orig_refresh";

/** 임퍼소네이션 시작 직전에 호출. 현재 dev 토큰을 보존한다. */
export function beginImpersonation(label: string): void {
  const access = localStorage.getItem("access");
  const refresh = localStorage.getItem("refresh");
  if (access) localStorage.setItem(ORIG_ACCESS, access);
  if (refresh) localStorage.setItem(ORIG_REFRESH, refresh);
  if (label) localStorage.setItem(ORIG_LABEL, label);
}

/** 임퍼소네이션이 실제로 시작되지 않았을 때(에러) 보존본 폐기. */
export function abortImpersonation(): void {
  localStorage.removeItem(ORIG_ACCESS);
  localStorage.removeItem(ORIG_REFRESH);
  localStorage.removeItem(ORIG_LABEL);
}

/** 복귀: 보존된 dev 토큰으로 복원하고 /dev/dashboard 로 이동. */
export function endImpersonation(): void {
  const access = localStorage.getItem(ORIG_ACCESS);
  const refresh = localStorage.getItem(ORIG_REFRESH);
  if (access && refresh) {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
  }
  localStorage.removeItem(ORIG_ACCESS);
  localStorage.removeItem(ORIG_REFRESH);
  localStorage.removeItem(ORIG_LABEL);
  window.location.assign("/dev/dashboard");
}

export function isImpersonating(): boolean {
  return Boolean(localStorage.getItem(ORIG_ACCESS) && localStorage.getItem(ORIG_REFRESH));
}
