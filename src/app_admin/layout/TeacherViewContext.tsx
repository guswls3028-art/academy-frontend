/**
 * 선생앱: 모바일/PC 버전 강제 보기. 상단 "모바일 버전으로 보기" / "PC 버전으로 보기" 토글용.
 */
import { createContext, useContext, useCallback, useState, useEffect } from "react";

const STORAGE_KEY = "teacher-app-view";

export type ForceView = "mobile" | "desktop" | null;

function readStored(): ForceView {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "mobile" || v === "desktop") return v;
  } catch {
    // ignore
  }
  return null;
}

function writeStored(v: ForceView) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

type TeacherViewContextValue = {
  forceView: ForceView;
  setForceView: (v: ForceView) => void;
};

const TeacherViewContext = createContext<TeacherViewContextValue | null>(null);

export function TeacherViewProvider({ children }: { children: React.ReactNode }) {
  const [forceView, setState] = useState<ForceView>(readStored);

  useEffect(() => {
    writeStored(forceView);
  }, [forceView]);

  const setForceView = useCallback((v: ForceView) => {
    setState(v);
  }, []);

  return (
    <TeacherViewContext.Provider value={{ forceView, setForceView }}>
      {children}
    </TeacherViewContext.Provider>
  );
}

export function useTeacherView() {
  return useContext(TeacherViewContext);
}
