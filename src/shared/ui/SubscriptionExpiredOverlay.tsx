// PATH: src/shared/ui/SubscriptionExpiredOverlay.tsx
// 구독 만료 시 전체 화면 차단 오버레이 — 402 이벤트 수신

import { useState, useEffect } from "react";

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 36px",
          maxWidth: 440,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef2f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#111",
            margin: "0 0 8px",
          }}
        >
          구독이 만료되었습니다
        </h2>

        <p
          style={{
            fontSize: 14,
            color: "#666",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          서비스 이용 기간이 종료되었습니다.
          <br />
          계속 이용하시려면 관리자에게 문의하거나 구독을 갱신해 주세요.
        </p>

        {expired.plan && (
          <p style={{ fontSize: 12, color: "#999", margin: "0 0 16px" }}>
            요금제: {expired.plan}
            {expired.expires_at ? ` · 만료일: ${expired.expires_at}` : ""}
          </p>
        )}

        <button
          onClick={() => {
            // Redirect to login (clear session)
            try {
              localStorage.removeItem("access");
              localStorage.removeItem("refresh");
            } catch { /* ignore */ }
            window.location.href = "/login";
          }}
          style={{
            padding: "10px 32px",
            borderRadius: 8,
            background: "#6366f1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#4f46e5")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#6366f1")}
        >
          로그인 페이지로 이동
        </button>
      </div>
    </div>
  );
}
