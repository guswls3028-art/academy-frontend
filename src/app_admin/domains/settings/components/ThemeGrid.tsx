// PATH: src/app_admin/domains/settings/components/ThemeGrid.tsx
import type { ThemeKey, ThemeMeta } from "../constants/themes";
import ThemeCard from "./ThemeCard";
import styles from "./ThemeGrid.module.css";

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
    <div className={styles.grid}>
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
