// PATH: src/landing/components/ImageLightbox.tsx
// 글 상세 본문 이미지 클릭 시 풀스크린 lightbox.
// ESC/배경 클릭 닫기 + 좌우 swipe/keyboard(모바일) + zoom OK.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";

export default function ImageLightbox({ images, initialIndex, onClose }: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  if (images.length === 0) return null;
  const src = images[idx];

  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) setIdx((i) => (i - 1 + images.length) % images.length);
      else setIdx((i) => (i + 1) % images.length);
    }
    setTouchStartX(null);
  };

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="landing-image-lightbox"
      style={{
        position: "fixed", inset: 0, zIndex: 9990,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "lightboxFade 0.18s ease-out",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="닫기"
        style={{
          position: "fixed", top: 18, right: 18,
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
      </button>

      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw", maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
            aria-label="이전 이미지"
            style={navBtn("left")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
            aria-label="다음 이미지"
            style={navBtn("right")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6" /></svg>
          </button>
          <div style={{
            position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
            padding: "6px 14px", borderRadius: 999,
            background: "rgba(0,0,0,0.55)", color: "#fff",
            fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
          }}>{idx + 1} / {images.length}</div>
        </>
      )}
      <style>{`@keyframes lightboxFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "fixed",
    top: "50%", transform: "translateY(-50%)",
    [side]: 14,
    width: 50, height: 50, borderRadius: "50%",
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  } as React.CSSProperties;
}
