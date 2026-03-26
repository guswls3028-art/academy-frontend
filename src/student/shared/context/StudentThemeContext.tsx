/**
 * 학생앱 다크/라이트 모드 Context
 * localStorage에 영속화, data-student-dark 속성으로 CSS 제어
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

interface StudentThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (m: ThemeMode) => void;
}

const STORAGE_KEY = "hakwonplus:student-theme-mode";

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // SSR or localStorage unavailable
  }
  return "light";
}

const Ctx = createContext<StudentThemeCtx>({
  mode: "light",
  isDark: false,
  toggleMode: () => {},
  setMode: () => {},
});

export function StudentThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  // 다른 탭에서 변경 시 동기화
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light")) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <Ctx.Provider value={{ mode, isDark: mode === "dark", toggleMode, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStudentTheme() {
  return useContext(Ctx);
}
