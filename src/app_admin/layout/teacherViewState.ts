import { createContext } from "react";

export type ForceView = "mobile" | "desktop" | null;

export type TeacherViewContextValue = {
  forceView: ForceView;
  setForceView: (v: ForceView) => void;
};

export const TeacherViewContext = createContext<TeacherViewContextValue | null>(null);
