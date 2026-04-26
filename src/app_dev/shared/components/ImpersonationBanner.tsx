// PATH: src/app_dev/shared/components/ImpersonationBanner.tsx
// 임퍼소네이션 중일 때 화면 상단에 떠 있는 복귀 배너.
// dev 토큰을 localStorage["dev_orig_access"]/["dev_orig_refresh"]로 보존해두면 표시.

import { useEffect, useState } from "react";

const ORIG_ACCESS = "dev_orig_access";
const ORIG_REFRESH = "dev_orig_refresh";
const ORIG_LABEL = "dev_orig_label";

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
  const a = localStorage.getItem(ORIG_ACCESS);
  const r = localStorage.getItem(ORIG_REFRESH);
  if (a && r) {
    localStorage.setItem("access", a);
    localStorage.setItem("refresh", r);
  }
  localStorage.removeItem(ORIG_ACCESS);
  localStorage.removeItem(ORIG_REFRESH);
  localStorage.removeItem(ORIG_LABEL);
  window.location.assign("/dev/dashboard");
}

export function isImpersonating(): boolean {
  return Boolean(localStorage.getItem(ORIG_ACCESS) && localStorage.getItem(ORIG_REFRESH));
}

/** 모든 라우트에 떠 있는 작은 복귀 배너. dev 토큰 백업이 있을 때만 표시. */
export default function ImpersonationBanner() {
  const [active, setActive] = useState<boolean>(false);
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const sync = () => {
      setActive(isImpersonating());
      setLabel(localStorage.getItem(ORIG_LABEL) || "");
    };
    sync();
    window.addEventListener("storage", sync);
    // 같은 탭 내에서 begin/end 호출 시 즉시 반영하기 위한 폴링 (저비용)
    const t = setInterval(sync, 1500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(t);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 300,
        background: "linear-gradient(90deg, #f97316 0%, #ef4444 100%)",
        color: "#fff",
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      <span>🎭 임퍼소네이션 중{label ? `: ${label}` : ""} — 작업은 감사 로그에 기록됩니다.</span>
      <button
        type="button"
        onClick={endImpersonation}
        style={{
          padding: "3px 10px",
          fontSize: 12,
          fontWeight: 700,
          color: "#ef4444",
          background: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        dev로 복귀 ↩
      </button>
    </div>
  );
}
