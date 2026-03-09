// PATH: src/features/settings/pages/AppearancePage.tsx
// 설정 > 테마 — 그룹 헤더 프리미엄 UI (인터페이스 밀도 옵션 제거)

import { useEffect, useMemo, useState } from "react";
import { FiSun, FiMoon, FiStar } from "react-icons/fi";

import { THEMES, type ThemeKey, type ThemeMeta, isThemeKey } from "../constants/themes";
import { applyThemeToDom, loadThemeFromStorage } from "../theme/themeRuntime";
import ThemeCard from "../components/ThemeCard";

import "@/styles/design-system/colors/preview-theme.css";
import "@/styles/design-system/colors/preview-scope.css";
import s from "../components/SettingsSection.module.css";

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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AppearancePage() {
  const initialTheme: ThemeKey = useMemo(() => {
    const stored = loadThemeFromStorage();
    if (stored && isThemeKey(stored)) return stored;
    return safeThemeFromDom();
  }, []);

  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(initialTheme);

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme]);

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
    </div>
  );
}
