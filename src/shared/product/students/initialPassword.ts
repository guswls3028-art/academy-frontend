export type StudentInitialPasswordMode = "phone_last4" | "fixed" | "random";

export interface StudentInitialPasswordSettings {
  mode: StudentInitialPasswordMode;
  fixedPassword: string;
}

export const DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS: StudentInitialPasswordSettings = {
  mode: "phone_last4",
  fixedPassword: "1234",
};

export function isStudentInitialPasswordReady(
  settings: StudentInitialPasswordSettings,
  invalidStudentPhoneCount = 0,
  allowPartialRows = false,
): boolean {
  if (settings.mode === "phone_last4") {
    return allowPartialRows || invalidStudentPhoneCount === 0;
  }
  if (settings.mode === "fixed") return settings.fixedPassword.trim().length >= 4;
  return true;
}
