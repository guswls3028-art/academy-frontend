/* eslint-disable react-refresh/only-export-components -- responsive view hook and provider share one context boundary. */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

export type ForceView = "mobile" | "desktop" | null;

export type ResponsiveViewContextValue = {
  forceView: ForceView;
  setForceView: (v: ForceView) => void;
};

export const ResponsiveViewContext = createContext<ResponsiveViewContextValue | null>(null);

const STORAGE_KEY = "teacher-app-view";

function readStored(): ForceView {
  try {
    const v = getLocalItem(STORAGE_KEY);
    if (v === "mobile" || v === "desktop") return v;
  } catch {
    // ignore
  }
  return null;
}

function writeStored(v: ForceView) {
  try {
    if (v) setLocalItem(STORAGE_KEY, v);
    else removeLocalItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function ResponsiveViewProvider({ children }: { children: React.ReactNode }) {
  const [forceView, setState] = useState<ForceView>(readStored);

  useEffect(() => {
    writeStored(forceView);
  }, [forceView]);

  const setForceView = useCallback((v: ForceView) => {
    setState(v);
  }, []);

  return (
    <ResponsiveViewContext.Provider value={{ forceView, setForceView }}>
      {children}
    </ResponsiveViewContext.Provider>
  );
}

export function useResponsiveView() {
  return useContext(ResponsiveViewContext);
}
