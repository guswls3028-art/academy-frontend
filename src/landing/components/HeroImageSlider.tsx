// PATH: src/landing/components/HeroImageSlider.tsx
// 히어로 배경/시각 이미지 자동 슬라이드 (2026-05-12).
//
// 학원장 spec: "히어로 색션에 사진 올릴수있게해줘. 애니메이션으로 슬라이딩 돌아가게."
// - 0장: null 반환 (호출측에서 placeholder 처리)
// - 1장: 정적 image (캐러셀 X)
// - 2장↑: 5초 간격 자동 fade. dot 인디케이터. hover 시 일시정지. 키보드 ←→.
//
// 디자인: Apple-style refined — subtle dot, generous spacing, no harsh shadows.
// 인터랙션은 IntersectionObserver로 viewport 안에 있을 때만 회전(배경 탭 절약).
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";

interface Props {
  images: string[];
  /** aspect ratio CSS — 기본 4/3, contact-promo는 16/9. */
  aspectRatio?: string;
  /** border-radius — 템플릿 톤에 맞춤. 기본 16. */
  borderRadius?: number;
  /** alt 텍스트 prefix. 학원명 등. */
  altPrefix?: string;
  /** 그림자 톤 — light 템플릿은 soft, dark는 강하게. */
  shadow?: string;
  /** dot 색상 — primary_color 등. */
  dotColor?: string;
  /** auto-rotate 간격(ms). 기본 5000. */
  intervalMs?: number;
}

export default function HeroImageSlider({
  images,
  aspectRatio = "4/3",
  borderRadius = 16,
  altPrefix = "",
  shadow = "0 8px 30px rgba(0,0,0,0.08)",
  dotColor = "#fff",
  intervalMs = 5000,
}: Props) {
  const valid = (images || []).filter((u) => typeof u === "string" && u.trim().length > 0);
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const [inView, setInView] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // viewport 안에 있을 때만 회전 (offscreen에서 timer drift 방지)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || valid.length < 2) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [valid.length]);

  // auto-rotate
  useEffect(() => {
    if (valid.length < 2 || hover || !inView) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % valid.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [valid.length, hover, inView, intervalMs]);

  // 키보드 ←→
  useEffect(() => {
    if (valid.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + valid.length) % valid.length);
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % valid.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [valid.length]);

  if (valid.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio,
        borderRadius,
        overflow: "hidden",
        boxShadow: shadow,
        background: "#0f172a",
      }}
      role={valid.length > 1 ? "region" : undefined}
      aria-roledescription={valid.length > 1 ? "캐러셀" : undefined}
      aria-label={valid.length > 1 ? "히어로 이미지 슬라이드" : undefined}
    >
      {valid.map((src, i) => (
        <img
          key={src + i}
          src={src}
          alt={altPrefix ? `${altPrefix} ${i + 1}` : ""}
          loading={i === 0 ? "eager" : "lazy"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === idx ? 1 : 0,
            transition: "opacity 1.2s cubic-bezier(.4,0,.2,1)",
            transform: i === idx ? "scale(1)" : "scale(1.03)",
            transitionProperty: "opacity, transform",
            transitionDuration: "1.2s, 6s",
          }}
        />
      ))}
      {/* dot 인디케이터 — 1장이면 hide */}
      {valid.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.28)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`이미지 ${i + 1}로 이동`}
              style={{
                width: i === idx ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? dotColor : "rgba(255,255,255,0.45)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.3s, background 0.3s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
