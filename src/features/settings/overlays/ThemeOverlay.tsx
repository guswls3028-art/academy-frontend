// PATH: src/features/settings/overlays/ThemeOverlay.tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ThemeGrid from "../components/ThemeGrid";
import { THEMES } from "../constants/themes";
import type { ThemeKey } from "../constants/themes";
import { fetchThemeSettings, updateThemeSettings } from "../api/theme";

type Props = {
  onClose: () => void;
};

function safeGetCurrentTheme(): ThemeKey {
  try {
    const v = String(document.documentElement.getAttribute("data-theme") || "").trim();
    const keys = THEMES.map((t) => t.key);
    return (keys.includes(v as ThemeKey) ? (v as ThemeKey) : "modern-white") as ThemeKey;
  } catch {
    return "modern-white";
  }
}

function applyThemeToDom(theme: ThemeKey) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
}

export default function ThemeOverlay({ onClose }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "theme"],
    queryFn: fetchThemeSettings,
    staleTime: 60_000,
  });

  const serverTheme = (data?.theme as ThemeKey | undefined) ?? safeGetCurrentTheme();
  const [focus, setFocus] = useState<ThemeKey>(serverTheme);

  const themes = useMemo(() => THEMES, []);

  const mut = useMutation({
    mutationFn: async (next: ThemeKey) => updateThemeSettings(next),
    onMutate: async (next: ThemeKey) => {
      await qc.cancelQueries({ queryKey: ["settings", "theme"] });

      const prev = qc.getQueryData<{ theme: ThemeKey }>(["settings", "theme"]);
      qc.setQueryData(["settings", "theme"], { theme: next });

      applyThemeToDom(next);

      return { prev };
    },
    onError: (_err, _next, ctx) => {
      const rollback = (ctx as any)?.prev?.theme as ThemeKey | undefined;
      if (rollback) {
        qc.setQueryData(["settings", "theme"], { theme: rollback });
        applyThemeToDom(rollback);
      }
    },
    onSuccess: (res) => {
      const next = (res?.theme as ThemeKey | undefined) ?? focus;
      qc.setQueryData(["settings", "theme"], { theme: next });
      applyThemeToDom(next);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["settings", "theme"] });
    },
  });

  const currentTheme = (qc.getQueryData<{ theme: ThemeKey }>(["settings", "theme"])?.theme ??
    serverTheme) as ThemeKey;

  const isSaving = mut.isPending;
  const canApply = focus !== currentTheme && !isSaving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.42)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "min(86vh, 900px)",
          overflow: "auto",
          borderRadius: 14,
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.30)",
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid var(--color-border-divider)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text-primary)" }}>
              테마
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
              테마는 서버 설정이 단일 진실이며, UI는 즉시 반영 후 저장합니다.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {isLoading ? (
            <div
              className="panel"
              style={{
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface)",
                padding: 18,
              }}
            >
              <div className="skeleton" style={{ height: 12, borderRadius: 8, width: 220 }} />
              <div style={{ height: 10 }} />
              <div className="skeleton" style={{ height: 10, borderRadius: 8, width: "60%" }} />
              <div style={{ height: 14 }} />
              <div className="skeleton" style={{ height: 180, borderRadius: 14, width: "100%" }} />
            </div>
          ) : (
            <ThemeGrid
              themes={themes}
              current={currentTheme}
              focused={focus}
              isSaving={isSaving}
              onSelect={(k) => setFocus(k)}
            />
          )}
        </div>

        <div
          style={{
            padding: 18,
            borderTop: "1px solid var(--color-border-divider)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "color-mix(in srgb, var(--color-bg-surface) 92%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setFocus(currentTheme);
              applyThemeToDom(currentTheme);
            }}
            disabled={focus === currentTheme || isSaving}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 10,
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              fontWeight: 900,
              cursor: focus === currentTheme || isSaving ? "not-allowed" : "pointer",
              opacity: focus === currentTheme || isSaving ? 0.6 : 1,
            }}
          >
            되돌리기
          </button>

          <button
            type="button"
            onClick={() => mut.mutate(focus)}
            disabled={!canApply}
            style={{
              height: 44,
              padding: "0 22px",
              borderRadius: 10,
              border: "1px solid var(--color-brand-primary)",
              background: "var(--color-brand-primary)",
              color: "var(--color-text-inverse)",
              fontWeight: 900,
              cursor: canApply ? "pointer" : "not-allowed",
              opacity: canApply ? 1 : 0.6,
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
