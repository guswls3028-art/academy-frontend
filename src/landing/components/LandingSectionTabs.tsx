// PATH: src/landing/components/LandingSectionTabs.tsx
// 메인 랜딩 상단 sticky section tabs (#68, 2026-05-12).
//
// 학원장 spec (2026-05-12, nexon dnfm 스크린샷 4장):
//   "메인 페이지를 상단에 소개 탭 및 나머지도 같은 식으로 상단 탭으로 구현하면 좋을듯"
//
// 동작:
//   - hero 영역 지나 scroll > 200px 시점부터 NavBar(top:0) 아래에 sticky strip slide-down.
//   - 학원장 enabled sections 자동 매핑 (NAV_SECTION_ANCHORS 라벨).
//   - 가로 스크롤 가능 (모바일 협소 뷰 대응). 스크롤바 시각 숨김.
//   - 현재 viewport 중앙에 있는 section auto-highlight.
//   - 클릭 시 scroll + window history hash 갱신.
//
// 범위: PublicLandingPage 전용. ReportsList/Detail/Community/Share 등 sub 페이지 미적용.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingSection } from "../types";
import type { NavBarTokens } from "../templates/shared";
import { NAV_SECTION_ANCHORS } from "../templates/shared";

interface Props {
  sections: LandingSection[];
  tokens: NavBarTokens;
}

// strip에 노출할 우선 순위 (학원장 enable section만 필터 통과).
// hero는 "처음으로" 의미로 별도 label.
const SECTION_ORDER: Array<{ type: string; label: string }> = [
  { type: "hero", label: "처음으로" },
  { type: "instructor_profile", label: "강사" },
  { type: "features", label: "수업 특징" },
  { type: "programs", label: "프로그램" },
  { type: "hit_reports", label: "매치업" },
  { type: "management_system", label: "학생 관리" },
  { type: "process_timeline", label: "수업 흐름" },
  { type: "testimonials", label: "후기" },
  { type: "community_preview", label: "커뮤니티" },
  { type: "faq", label: "FAQ" },
  { type: "contact", label: "문의" },
];

export default function LandingSectionTabs({ sections, tokens }: Props) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<string>("hero");
  const stripRef = useRef<HTMLDivElement | null>(null);

  // 가시화 sections — 학원장 enable + 알려진 type만.
  const items = useMemo(() => {
    const enabled = new Set<string>(sections.filter((s) => s.enabled).map((s) => s.type));
    // hero는 항상 존재 (template root) — 명시 enable 무관 노출. 단 학원장이 hero 자체를 disable 했다면 빼기.
    const heroEnabled = sections.find((s) => s.type === "hero")?.enabled ?? true;
    return SECTION_ORDER.filter((it) => (it.type === "hero" ? heroEnabled : enabled.has(it.type)));
  }, [sections]);

  // scroll-driven visibility + active section detection.
  // perf 최적화 (#68 후속, 2026-05-12): 매 scroll frame 마다 querySelectorAll 호출 X.
  // mount + resize + items 변경 시에만 offsets cache. scroll 핸들러는 cached array 만 read.
  useEffect(() => {
    if (items.length <= 1) return;  // 1개면 strip 의미 없음 (hero only).

    let offsets: Array<{ type: string; top: number }> = [];
    const computeOffsets = () => {
      const next: typeof offsets = [];
      for (const it of items) {
        const el = document.querySelector(`section[data-stype="${it.type}"]`) as HTMLElement | null;
        if (el) next.push({ type: it.type, top: el.offsetTop });
      }
      offsets = next;
    };

    // section element 가 비동기 mount 되는 케이스 (LandingPage fetch 이후) 대응 — 짧은 retry.
    let retries = 0;
    const tryCompute = () => {
      computeOffsets();
      if (offsets.length === 0 && retries++ < 20) setTimeout(tryCompute, 150);
    };
    tryCompute();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setVisible(y > 200);
        if (offsets.length) {
          // strip이 NavBar(64) + strip(48) 아래에 sticky이므로 그만큼 보정한 ref line.
          const refLine = y + 64 + 48 + 8;
          let current = offsets[0].type;
          for (const o of offsets) {
            if (o.top <= refLine) current = o.type;
            else break;
          }
          setActive(current);
        }
        ticking = false;
      });
    };
    const onResize = () => { computeOffsets(); onScroll(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [items]);

  // active 변경 시 strip 내 chip을 가시 영역에 스크롤.
  useEffect(() => {
    if (!stripRef.current) return;
    const chip = stripRef.current.querySelector<HTMLElement>(`[data-stab="${active}"]`);
    if (chip) {
      const stripRect = stripRef.current.getBoundingClientRect();
      const chipRect = chip.getBoundingClientRect();
      if (chipRect.left < stripRect.left + 16 || chipRect.right > stripRect.right - 16) {
        chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [active]);

  if (items.length <= 1) return null;

  const onClick = (type: string) => {
    const el = document.querySelector(`section[data-stype="${type}"]`) as HTMLElement | null;
    if (!el) return;
    // NavBar(64) + strip(48) 만큼 더 위로 보정.
    window.scrollTo({ top: el.offsetTop - 64 - 48 - 4, behavior: "smooth" });
    // hash 갱신 (broadcast/공유 URL 자연스러움) — replaceState 로 history pollute 방지.
    try {
      window.history.replaceState(null, "", `/landing#${type}`);
    } catch { /* noop */ }
  };

  const isDark = tokens.bg.includes("10,14,26");
  const inactiveBg = "transparent";
  const inactiveColor = tokens.textSecondary;
  const inactiveBorder = `1px solid ${tokens.border}`;
  const activeBg = `rgba(${tokens.primaryRgb}, 0.16)`;
  const activeColor = tokens.primaryColor;
  const activeBorder = `1px solid rgba(${tokens.primaryRgb}, 0.5)`;
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";

  return (
    <div
      aria-label="섹션 빠른 이동"
      data-testid="landing-section-tabs"
      style={{
        position: "fixed",
        top: 64,
        left: 0,
        right: 0,
        zIndex: 45,
        background: tokens.bg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${tokens.border}`,
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "transform 0.22s cubic-bezier(.2,.7,.2,1), opacity 0.18s",
      }}
    >
      <div
        ref={stripRef}
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 16px",
          overflowX: "auto",
          // 스크롤바 시각 숨김 (memory: 사이드바 스크롤바 숨김 패턴과 동일)
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`[data-testid="landing-section-tabs"] > div::-webkit-scrollbar { display: none; }`}</style>
        {items.map((it) => {
          const isActive = active === it.type;
          const label = it.label || NAV_SECTION_ANCHORS[it.type] || it.type;
          return (
            <button
              key={it.type}
              type="button"
              data-stab={it.type}
              onClick={() => onClick(it.type)}
              aria-current={isActive ? "page" : undefined}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 600,
                borderRadius: 999,
                background: isActive ? activeBg : inactiveBg,
                color: isActive ? activeColor : inactiveColor,
                border: isActive ? activeBorder : inactiveBorder,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = inactiveBg;
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
