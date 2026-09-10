export type StudentInitialPasswordMode = "fixed" | "random";

export interface StudentInitialPasswordSettings {
  mode: StudentInitialPasswordMode;
  fixedPassword: string;
}

export const DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS: StudentInitialPasswordSettings = {
  mode: "fixed",
  fixedPassword: "",
};

export function isStudentInitialPasswordReady(
  settings: StudentInitialPasswordSettings,
): boolean {
  if (settings.mode === "fixed") return settings.fixedPassword.trim().length >= 4;
  return true;
}
