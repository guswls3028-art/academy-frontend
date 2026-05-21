// PATH: src/shared/ui/SubscriptionExpiredOverlay.tsx
// 구독 만료 시 전체 화면 차단 오버레이 — 402 이벤트 수신

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { clearTokens } from "@/shared/api/axios";
import styles from "./SubscriptionExpiredOverlay.module.css";

type ExpiredDetail = {
  detail?: string;
  code?: string;
  plan?: string;
  expires_at?: string | null;
};

export default function SubscriptionExpiredOverlay() {
  const [expired, setExpired] = useState<ExpiredDetail | null>(null);

  useEffect(() => {
    function handleExpired(e: Event) {
      const detail = (e as CustomEvent).detail ?? {};
      setExpired(detail);
    }
    window.addEventListener("subscription-expired", handleExpired);
    return () => window.removeEventListener("subscription-expired", handleExpired);
  }, []);

  if (!expired) return null;

  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="subscription-expired-title">
      <div className={styles.panel}>
        <div className={styles.iconWrap}>
          <AlertTriangle className={styles.icon} aria-hidden />
        </div>

        <h2 id="subscription-expired-title" className={styles.title}>
          구독이 만료되었습니다
        </h2>

        <p className={styles.description}>
          서비스 이용 기간이 종료되었습니다.
          <br />
          계속 이용하시려면 관리자에게 문의하거나 구독을 갱신해 주세요.
        </p>

        {expired.plan && (
          <p className={styles.plan}>
            요금제: {{ standard: "Standard", pro: "Pro", max: "Max" }[expired.plan] ?? expired.plan}
            {expired.expires_at ? ` · 만료일: ${expired.expires_at}` : ""}
          </p>
        )}

        <button
          onClick={() => {
            clearTokens();
            window.location.href = "/login";
          }}
          className={styles.actionButton}
        >
          로그인 페이지로 이동
        </button>
      </div>
    </div>
  );
}
