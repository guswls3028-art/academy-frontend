// PATH: src/features/settings/pages/AppearancePage.tsx
// 설정 > 테마 — 그룹 헤더 + 인터페이스 밀도 옵션 포함 프리미엄 UI

import { useEffect, useMemo, useState } from "react";
import { FiSun, FiMoon, FiStar } from "react-icons/fi";

import { THEMES, type ThemeKey, type ThemeMeta, isThemeKey } from "../constants/themes";
import { applyThemeToDom, loadThemeFromStorage } from "../theme/themeRuntime";
import ThemeCard from "../components/ThemeCard";

import "@/styles/design-system/colors/preview-theme.css";
import "@/styles/design-system/colors/preview-scope.css";
import s from "../components/SettingsSection.module.css";

// ── Density ─────────────────────────────────────────────────────────────────
const DENSITY_KEY = "hakwonplus:density";
type Density = "comfortable" | "compact";

function loadDensity(): Density {
  try {
    const v = localStorage.getItem(DENSITY_KEY);
    if (v === "compact" || v === "comfortable") return v;
  } catch {}
  return "comfortable";
}

function applyDensity(d: Density) {
  document.documentElement.setAttribute("data-density", d);
  try {
    localStorage.setItem(DENSITY_KEY, d);
  } catch {}
}

// ── Theme group config ───────────────────────────────────────────────────────
type GroupConfig = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  themes: ThemeMeta[];
};

function safeThemeFromDom(): ThemeKey {
  const v = String(document.documentElement.getAttribute("data-theme") || "").trim();
  return isThemeKey(v) ? (v as ThemeKey) : "modern-white";
}

// ── Theme group section ──────────────────────────────────────────────────────
function ThemeGroupSection({
  group,
  currentTheme,
  onSelect,
}: {
  group: GroupConfig;
  currentTheme: ThemeKey;
  onSelect: (key: ThemeKey) => void;
}) {
  const Icon = group.icon;
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Icon
          size={14}
          style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
          aria-hidden
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          {group.label}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          — {group.description}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {group.themes.map((t) => (
          <ThemeCard
            key={t.key}
            theme={t}
            selected={t.key === currentTheme}
            previewed={t.key === currentTheme}
            dirty={false}
            onSelect={() => onSelect(t.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Density selector ─────────────────────────────────────────────────────────
const DENSITY_OPTIONS: { value: Density; label: string; desc: string }[] = [
  { value: "comfortable", label: "편안하게", desc: "기본 여백 · 여유있는 레이아웃" },
  { value: "compact", label: "컴팩트", desc: "좁은 여백 · 더 많은 정보" },
];

function DensitySelector({
  current,
  onChange,
}: {
  current: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {DENSITY_OPTIONS.map((opt) => {
        const isSelected = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 10,
              border: isSelected
                ? "2px solid var(--color-border-focus)"
                : "1px solid var(--color-border-divider)",
              background: isSelected
                ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-surface))"
                : "var(--color-bg-surface)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 13.5,
                fontWeight: isSelected ? 700 : 500,
                color: isSelected
                  ? "var(--color-primary)"
                  : "var(--color-text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {opt.label}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              {opt.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AppearancePage() {
  const initialTheme: ThemeKey = useMemo(() => {
    const stored = loadThemeFromStorage();
    if (stored && isThemeKey(stored)) return stored;
    return safeThemeFromDom();
  }, []);

  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(initialTheme);
  const [density, setDensity] = useState<Density>(loadDensity);

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme]);

  const handleDensity = (d: Density) => {
    setDensity(d);
    applyDensity(d);
  };

  const groups: GroupConfig[] = useMemo(
    () => [
      {
        id: "WHITE",
        label: "라이트",
        description: "밝은 배경 테마",
        icon: FiSun,
        themes: THEMES.filter((t) => t.group === "WHITE"),
      },
      {
        id: "DARK",
        label: "다크",
        description: "어두운 배경 테마",
        icon: FiMoon,
        themes: THEMES.filter((t) => t.group === "DARK"),
      },
      {
        id: "BRAND",
        label: "브랜드",
        description: "브랜드 컬러 기반 테마",
        icon: FiStar,
        themes: THEMES.filter((t) => t.group === "BRAND"),
      },
    ],
    []
  );

  const handleSelect = (key: ThemeKey) => {
    setCurrentTheme(key);
    applyThemeToDom(key);
  };

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>테마</h2>
        <p className={s.sectionDescription}>
          선택한 테마가 즉시 적용됩니다. 브라우저에 저장되므로 다음 방문 시에도 유지됩니다.
        </p>
      </div>

      {/* Theme groups */}
      <section className={s.section}>
        {groups.map((group) => (
          <ThemeGroupSection
            key={group.id}
            group={group}
            currentTheme={currentTheme}
            onSelect={handleSelect}
          />
        ))}
      </section>

      {/* Density */}
      <section className={s.section}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle} style={{ fontSize: 14 }}>인터페이스 밀도</h2>
          <p className={s.sectionDescription}>화면 여백과 레이아웃 밀도를 설정합니다.</p>
        </div>
        <DensitySelector current={density} onChange={handleDensity} />
      </section>
    </div>
  );
}
