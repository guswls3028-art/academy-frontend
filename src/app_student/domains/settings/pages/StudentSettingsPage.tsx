/**
 * 설정 — 내 정보 링크 + 화면 모드(라이트/다크/시스템) 전환
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconUser } from "@student/shared/ui/icons/Icons";
import { useStudentTheme } from "@student/shared/context/StudentThemeContext";

type ThemeOption = { key: "light" | "dark" | "system"; label: string; icon: React.ReactNode };

const THEME_OPTIONS: ThemeOption[] = [
  {
    key: "light",
    label: "라이트",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    key: "dark",
    label: "다크",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
  {
    key: "system",
    label: "시스템",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

export default function StudentSettingsPage() {
  const { mode, setMode } = useStudentTheme();

  return (
    <StudentPageShell title="설정" description="계정 및 앱 설정">
      <div className="student-settings-stack">
        {/* 내 정보 */}
        <Link to="/student/profile" className="student-settings-link">
          <IconUser className="student-settings-link__icon" />
          <span>내 정보</span>
        </Link>

        {/* 화면 모드 */}
        <div className="student-settings-card">
          <div className="student-settings-card__title">
            화면 모드
          </div>
          <div className="student-settings-mode-grid">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-pressed={mode === opt.key}
                onClick={() => setMode(opt.key)}
                className={`student-settings-mode${mode === opt.key ? " student-settings-mode--active" : ""}`}
              >
                {opt.icon}
                <span>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
