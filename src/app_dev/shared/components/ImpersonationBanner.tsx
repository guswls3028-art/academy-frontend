// PATH: src/app_dev/shared/components/ImpersonationBanner.tsx
// 임퍼소네이션 중일 때 화면 상단에 떠 있는 복귀 배너.
// dev 토큰을 localStorage["dev_orig_access"]/["dev_orig_refresh"]로 보존해두면 표시.

import { useEffect, useState } from "react";
import {
  ORIG_LABEL,
  endImpersonation,
  isImpersonating,
} from "@dev/shared/components/impersonationSession";
import styles from "./ImpersonationBanner.module.css";

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
    <div className={styles.banner}>
      <span>🎭 임퍼소네이션 중{label ? `: ${label}` : ""} — 작업은 감사 로그에 기록됩니다.</span>
      <button type="button" className={styles.returnButton} onClick={endImpersonation}>
        dev로 복귀 ↩
      </button>
    </div>
  );
}
