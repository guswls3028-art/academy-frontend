// PATH: src/context/ThemeContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type ThemeKey = "modern" | "navy" | "kakao" | "naver" | "purple";

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "app-theme";
const DEFAULT_THEME: ThemeKey = "modern";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);

  // 초기 테마 복원
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeKey | null;

    // ❗ legacy dark class가 혹시 붙어있다면 제거 (화이트/다크 강제 아님)
    document.documentElement.classList.remove("dark");

    if (saved) {
      setThemeState(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      document.documentElement.dataset.theme = DEFAULT_THEME;
    }
  }, []);

  const setTheme = (next: ThemeKey) => {
    // ❗ theme 변경 시에도 legacy dark 제거만 수행
    document.documentElement.classList.remove("dark");

    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
