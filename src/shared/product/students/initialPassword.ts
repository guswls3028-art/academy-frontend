export type StudentInitialPasswordMode = "fixed" | "random" | "tenant";

export interface StudentInitialPasswordSettings {
  mode: StudentInitialPasswordMode;
  fixedPassword: string;
}
