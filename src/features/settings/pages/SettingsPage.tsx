// PATH: src/features/settings/pages/SettingsPage.tsx
// 설정 > 시스템 설정 탭 콘텐츠 (SettingsLayout에서 사용)
import { useEffect, useMemo, useState } from "react";

import { Section, Panel } from "@/shared/ui/ds";

import ThemeGrid from "../components/ThemeGrid";
import { THEMES, type ThemeKey, isThemeKey } from "../constants/themes";
import {
  applyThemeToDom,
  loadThemeFromStorage,
} from "../theme/themeRuntime";

// ✅ preview tokens (SSOT)
import "@/styles/design-system/colors/preview-theme.css";
import "@/styles/design-system/colors/preview-scope.css";

function safeThemeFromDom(): ThemeKey {
  const v = String(document.documentElement.getAttribute("data-theme") || "").trim();
  return isThemeKey(v) ? (v as ThemeKey) : "modern-white";
}

export default function SettingsPage() {
  const initialTheme: ThemeKey = useMemo(() => {
    const stored = loadThemeFromStorage();
    if (stored && isThemeKey(stored)) return stored;
    return safeThemeFromDom();
  }, []);

  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(initialTheme);

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme]);

  return (
    <Section>
        <Panel>
          {/* Sticky Header */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "var(--color-bg-surface)",
              borderBottom: "1px solid var(--color-border-divider)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.2px",
                }}
              >
                테마
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--color-text-muted)",
                }}
              >
                선택 즉시 적용됩니다.
              </div>
            </div>
          </div>

          {/* Grid */}
          <div style={{ padding: 14 }}>
            <ThemeGrid
              themes={THEMES}
              currentTheme={currentTheme}
              previewTheme={currentTheme}
              onSelect={(k) => {
                setCurrentTheme(k);
                applyThemeToDom(k);
              }}
            />
          </div>
        </Panel>
    </Section>
  );
}
