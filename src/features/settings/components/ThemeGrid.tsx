// PATH: src/features/settings/components/ThemeGrid.tsx
import type { ThemeKey, ThemeMeta } from "../constants/themes";
import ThemeCard from "./ThemeCard";

type Props = {
  themes: ThemeMeta[];
  currentTheme: ThemeKey; // server current
  previewTheme: ThemeKey; // ui preview
  isApplying?: boolean;
  onSelect: (key: ThemeKey) => void;
};

export default function ThemeGrid({
  themes,
  currentTheme,
  previewTheme,
  isApplying,
  onSelect,
}: Props) {
  const dirty = previewTheme !== currentTheme;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      {themes.map((t) => (
        <ThemeCard
          key={t.key}
          theme={t}
          selected={t.key === currentTheme}
          previewed={t.key === previewTheme}
          dirty={dirty}
          disabled={isApplying}
          onSelect={() => onSelect(t.key)}
        />
      ))}
    </div>
  );
}
