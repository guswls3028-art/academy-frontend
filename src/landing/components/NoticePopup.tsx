// PATH: src/landing/components/NoticePopup.tsx
// 첫 진입 공지 popup — 학원장이 LandingConfig.notice_popup으로 enable.
// localStorage 24h skip + ESC/배경 클릭 닫기 + premium dark/light.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { NoticePopupConfig } from "../types";

const SKIP_KEY = "landing-notice-popup-skip"; // localStorage key

function readSkipUntil(): number {
  try {
    const raw = window.localStorage.getItem(SKIP_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch { return 0; }
}

function writeSkipUntil(ms: number) {
  try { window.localStorage.setItem(SKIP_KEY, String(ms)); } catch { /* ignore */ }
}

export default function NoticePopup({ notice }: { notice?: NoticePopupConfig | null }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!notice?.enabled) return;
    if (!notice.title && !notice.content) return;
    // expire_at 지나면 노출 X
    if (notice.expire_at) {
      const expired = Date.now() >= new Date(notice.expire_at).getTime();
      if (expired) return;
    }
    // 24h skip
    if (Date.now() < readSkipUntil()) return;
    setOpen(true);
  }, [notice]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !notice) return null;

  const onSkip24h = () => {
    writeSkipUntil(Date.now() + 24 * 60 * 60 * 1000);
    setOpen(false);
  };

  const onLink = () => {
    if (!notice.link) return;
    setOpen(false);
    if (notice.link.startsWith("/")) navigate(notice.link);
    else window.open(notice.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      data-testid="landing-notice-popup"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,12,22,0.6)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "noticeFade 0.2s ease-out",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="학원 공지"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "#0F1525",
          color: "#F5F1E8",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
          overflow: "hidden",
          animation: "noticeRise 0.24s cubic-bezier(0.32, 0.72, 0.32, 1)",
        }}
      >
        <div style={{
          padding: "26px 26px 16px",
          background: "linear-gradient(135deg, rgba(212,160,76,0.15) 0%, rgba(212,160,76,0.04) 100%)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4A04C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Notice · 공지
          </div>
          {notice.title && (
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.4 }}>{notice.title}</h2>
          )}
        </div>
        {notice.content && (
          <div style={{ padding: "18px 26px 6px", fontSize: 14, lineHeight: 1.7, color: "#E5E7EB", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {notice.content}
          </div>
        )}
        {notice.link && (
          <div style={{ padding: "12px 26px 0" }}>
            <button
              type="button"
              onClick={onLink}
              data-testid="landing-notice-popup-link"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 999,
                background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
                color: "#0A0E1A", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
              }}
            >
              자세히 보기 →
            </button>
          </div>
        )}
        <div style={{
          marginTop: 18,
          padding: "14px 22px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.18)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            type="button"
            onClick={onSkip24h}
            data-testid="landing-notice-popup-skip"
            style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}
          >24시간 동안 보지 않기</button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F1E8", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "7px 16px", borderRadius: 8 }}
          >닫기</button>
        </div>
      </div>
      <Link to="" style={{ display: "none" }} />
      <style>{`
        @keyframes noticeFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes noticeRise { from { transform: translateY(20px); opacity: 0.5 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
