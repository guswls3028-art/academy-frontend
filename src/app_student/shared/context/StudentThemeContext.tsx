/**
 * 학생앱 다크/라이트/시스템 모드 Context
 * localStorage에 영속화, data-student-dark 속성으로 CSS 제어
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type ThemeMode = "light" | "dark" | "system";

interface StudentThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (m: ThemeMode) => void;
}

const STORAGE_KEY = "hakwonplus:student-theme-mode";

function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    // SSR or localStorage unavailable
  }
  return "light";
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") return getSystemPrefersDark();
  return mode === "dark";
}

const Ctx = createContext<StudentThemeCtx>({
  mode: "light",
  isDark: false,
  toggleMode: () => {},
  setMode: () => {},
});

export function StudentThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [isDark, setIsDark] = useState(() => resolveIsDark(getInitialMode()));

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setIsDark(resolveIsDark(m));
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  const toggleMode = useCallback(() => {
    // system 모드일 때는 현재 실제 상태(isDark) 기준으로 반대 값으로 전환
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  // OS 테마 변경 시 system 모드에서 실시간 반영
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // 다른 탭에서 변경 시 동기화
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light" || e.newValue === "system")) {
        setModeState(e.newValue);
        setIsDark(resolveIsDark(e.newValue));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <Ctx.Provider value={{ mode, isDark, toggleMode, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStudentTheme() {
  return useContext(Ctx);
}
