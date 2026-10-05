import type { ThemeKey, ThemeMeta } from "../constants/themes";
import ThemeCard from "./ThemeCard";
import styles from "./ThemeGrid.module.css";

type Props = {
  themes: ThemeMeta[];
  currentTheme: ThemeKey;
  isApplying?: boolean;
  onSelect: (key: ThemeKey) => void;
};

export default function ThemeGrid({ themes, currentTheme, isApplying, onSelect }: Props) {
  return (
    <div className={styles.grid}>
      {themes.map((theme) => (
        <ThemeCard
          key={theme.key}
          theme={theme}
          selected={theme.key === currentTheme}
          disabled={isApplying}
          onSelect={() => onSelect(theme.key)}
        />
      ))}
    </div>
  );
}
