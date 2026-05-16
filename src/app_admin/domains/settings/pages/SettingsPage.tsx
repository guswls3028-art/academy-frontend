/* eslint-disable no-restricted-syntax -- legacy settings panel uses tokenized inline styles; this change only centralizes theme state. */
// PATH: src/app_admin/domains/settings/pages/SettingsPage.tsx
// 설정 > 시스템 설정 탭 콘텐츠 (SettingsLayout에서 사용)
import { Section, Panel } from "@/shared/ui/ds";
import { useTheme } from "@/shared/contexts/ThemeContext";

import ThemeGrid from "../components/ThemeGrid";
import { THEMES } from "../constants/themes";

// ✅ preview tokens (SSOT)
import "@/styles/design-system/colors/preview-theme.css";
import "@/styles/design-system/colors/preview-scope.css";

export default function SettingsPage() {
  const { theme: currentTheme, setTheme } = useTheme();

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
                  fontSize: 14,
                  fontWeight: 700,
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
              onSelect={setTheme}
            />
          </div>
        </Panel>
    </Section>
  );
}
