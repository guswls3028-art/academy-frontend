// PATH: src/app_teacher/domains/settings/pages/AppearancePage.tsx
// 외관(테마) — 테마 12종 선택. 데스크톱 applyThemeToDom 재사용.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import {
  THEMES,
  type ThemeKey,
  type ThemeGroup,
  isThemeKey,
} from "@admin/domains/settings/constants/themes";
import { applyThemeToDom } from "@admin/domains/settings/theme/themeRuntime";

const GROUP_LABEL: Record<ThemeGroup, string> = {
  WHITE: "라이트",
  DARK: "다크",
  BRAND: "브랜드",
};

function currentFromDom(): ThemeKey {
  const v = String(document.documentElement.getAttribute("data-theme") || "").trim();
  return isThemeKey(v) ? (v as ThemeKey) : "modern-white";
}

export default function AppearancePage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<ThemeKey>(currentFromDom());

  useEffect(() => {
    const listener = () => setCurrent(currentFromDom());
    window.addEventListener("themechange", listener);
    return () => window.removeEventListener("themechange", listener);
  }, []);

  const select = (key: ThemeKey) => {
    applyThemeToDom(key);
    setCurrent(key);
  };

  const grouped = (["WHITE", "DARK", "BRAND"] as ThemeGroup[]).map((g) => ({
    group: g,
    themes: THEMES.filter((t) => t.group === g).sort((a, b) => a.order - b.order),
  }));

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>외관</h1>
      </div>

      {grouped.map(({ group, themes }) => (
        <div key={group}>
          <SectionTitle>{GROUP_LABEL[group]}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => {
              const active = t.key === current;
              return (
                <button
                  key={t.key}
                  onClick={() => select(t.key)}
                  className="flex flex-col items-start text-left cursor-pointer rounded-xl"
                  data-theme={t.key}
                  style={{
                    padding: "var(--tc-space-3) var(--tc-space-4)",
                    minHeight: "calc(var(--tc-touch-min) + 32px)",
                    background: "var(--color-bg-canvas, var(--tc-surface))",
                    color: "var(--color-text-primary, var(--tc-text))",
                    border: active
                      ? "2px solid var(--color-brand-primary, var(--tc-primary))"
                      : "1px solid var(--color-border-subtle, var(--tc-border))",
                    boxShadow: active ? "0 0 0 3px color-mix(in srgb, var(--color-brand-primary, var(--tc-primary)) 20%, transparent)" : "none",
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="rounded-full"
                      style={{ width: 12, height: 12, background: "var(--color-brand-primary, var(--tc-primary))" }}
                    />
                    <span className="text-[13px] font-bold">{t.name}</span>
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-secondary, var(--tc-text-secondary))" }}>
                    {t.desc}
                  </div>
                  {active && (
                    <div className="text-[10px] font-bold mt-1" style={{ color: "var(--color-brand-primary, var(--tc-primary))" }}>
                      · 적용 중
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Card>
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--tc-text-muted)" }}>
          테마는 이 기기에만 적용됩니다. (로컬 저장)
        </div>
      </Card>
    </div>
  );
}
