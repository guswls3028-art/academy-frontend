import { useMemo } from "react";
import { FiSun, FiMoon, FiStar } from "react-icons/fi";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { THEMES } from "../constants/themes";
import ThemeGrid from "../components/ThemeGrid";
import s from "../components/SettingsSection.module.css";

export default function AppearancePage() {
  const { theme: currentTheme, setTheme } = useTheme();
  const groups = useMemo(() => [
    { id: "WHITE", label: "라이트", description: "밝은 배경 테마", icon: FiSun },
    { id: "DARK", label: "다크", description: "어두운 배경 테마", icon: FiMoon },
    { id: "BRAND", label: "브랜드", description: "브랜드 컬러 기반 테마", icon: FiStar },
  ].map((group) => ({ ...group, themes: THEMES.filter((theme) => theme.group === group.id) })), []);

  return (
    <div className={s.page}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>테마</h2>
        <p className={s.sectionDescription}>
          선택한 테마가 즉시 적용됩니다. 브라우저에 저장되므로 다음 방문 시에도 유지됩니다.
        </p>
      </div>
      <section className={s.section}>
        {groups.map(({ id, label, description, icon: Icon, themes }) => (
          <section key={id} className={s.themeGroup} aria-labelledby={`theme-group-${id}`}>
            <h3 id={`theme-group-${id}`} className={s.themeGroupTitle}>
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
              <span className={s.themeGroupDescription}>{description}</span>
            </h3>
            <ThemeGrid themes={themes} currentTheme={currentTheme} onSelect={setTheme} />
          </section>
        ))}
      </section>
    </div>
  );
}
