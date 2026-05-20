/**
 * 선생앱: 모바일/PC 버전 강제 보기. 상단 "모바일 버전으로 보기" / "PC 버전으로 보기" 토글용.
 */
import { useCallback, useState, useEffect } from "react";
import { TeacherViewContext, type ForceView } from "./teacherViewState";

const STORAGE_KEY = "teacher-app-view";

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
