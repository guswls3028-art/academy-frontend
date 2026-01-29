// PATH: src/shared/ui/theme/ThemeSwitcher.tsx
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";

const themes = [
  { key: "modern", label: "모던" },
  { key: "navy", label: "네이비" },
  { key: "kakao", label: "카카오" },
  { key: "naver", label: "네이버" },
  { key: "purple", label: "퍼플" },
] as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="ts-container">
      <button
        className="ts-trigger"
        onClick={() => setOpen((p) => !p)}
      >
        테마 변경
      </button>

      {open && (
        <div className="ts-dropdown">
          {themes.map((t) => (
            <button
              key={t.key}
              className={`ts-option ${theme === t.key ? "active" : ""}`}
              onClick={() => {
                setTheme(t.key);
                setOpen(false);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
