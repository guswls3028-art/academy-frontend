import { useEffect, useState } from "react";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function VersionChecker() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // In dev mode, __BUILD_TIMESTAMP__ is not defined — skip entirely
    if (typeof __BUILD_TIMESTAMP__ === "undefined") return;

    const currentVersion = __BUILD_TIMESTAMP__;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== currentVersion) {
          setShowBanner(true);
        }
      } catch {
        // network error — ignore silently
      }
    };

    const interval = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#2563eb",
        color: "#fff",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <span>새로운 업데이트가 있습니다.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#fff",
          color: "#2563eb",
          border: "none",
          borderRadius: 6,
          padding: "4px 16px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        새로고침
      </button>
      <button
        onClick={() => setShowBanner(false)}
        style={{
          background: "transparent",
          color: "rgba(255,255,255,0.7)",
          border: "none",
          fontSize: 18,
          cursor: "pointer",
          padding: "0 4px",
          lineHeight: 1,
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  );
}
