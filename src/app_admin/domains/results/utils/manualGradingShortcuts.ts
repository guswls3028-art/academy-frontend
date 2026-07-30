import type { ManualGradeState } from "../api/manualExamGrading";

export type ManualGradingShortcutSettings = {
  correct: string;
  incorrect: string;
  review: string;
};

export const DEFAULT_MANUAL_GRADING_SHORTCUTS: ManualGradingShortcutSettings = {
  correct: "O",
  incorrect: "X",
  review: "0",
};

export const MANUAL_GRADING_SHORTCUT_STORAGE_KEY =
  "academy.manual-grading-shortcuts.v1";

const RESERVED_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Backspace",
  "Delete",
  "Enter",
  "Escape",
  "Tab",
]);

export function normalizeManualGradingShortcutKey(key: string): string | null {
  if (RESERVED_KEYS.has(key) || key.trim() === "" || Array.from(key).length !== 1) {
    return null;
  }
  return /^[a-z]$/i.test(key) ? key.toUpperCase() : key;
}

export function validateManualGradingShortcuts(
  value: ManualGradingShortcutSettings,
): string | null {
  const normalized = [
    normalizeManualGradingShortcutKey(value.correct),
    normalizeManualGradingShortcutKey(value.incorrect),
    normalizeManualGradingShortcutKey(value.review),
  ];
  if (normalized.some((key) => key == null)) {
    return "방향키, Enter, Tab을 제외한 한 글자 키를 지정해 주세요.";
  }
  if (new Set(normalized.map((key) => key?.toLocaleLowerCase("ko-KR"))).size !== 3) {
    return "정답, 오답, 복습은 서로 다른 키를 사용해야 합니다.";
  }
  return null;
}

export function loadManualGradingShortcuts(
  storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): ManualGradingShortcutSettings {
  if (!storage) return DEFAULT_MANUAL_GRADING_SHORTCUTS;
  try {
    const raw = storage.getItem(MANUAL_GRADING_SHORTCUT_STORAGE_KEY);
    if (!raw) return DEFAULT_MANUAL_GRADING_SHORTCUTS;
    const parsed = JSON.parse(raw) as Partial<ManualGradingShortcutSettings>;
    const candidate = {
      correct: normalizeManualGradingShortcutKey(String(parsed.correct ?? "")) ?? "",
      incorrect: normalizeManualGradingShortcutKey(String(parsed.incorrect ?? "")) ?? "",
      review: normalizeManualGradingShortcutKey(String(parsed.review ?? "")) ?? "",
    };
    return validateManualGradingShortcuts(candidate) == null
      ? candidate
      : DEFAULT_MANUAL_GRADING_SHORTCUTS;
  } catch {
    return DEFAULT_MANUAL_GRADING_SHORTCUTS;
  }
}

export function saveManualGradingShortcuts(
  value: ManualGradingShortcutSettings,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): ManualGradingShortcutSettings {
  const normalized = {
    correct: normalizeManualGradingShortcutKey(value.correct) ?? "",
    incorrect: normalizeManualGradingShortcutKey(value.incorrect) ?? "",
    review: normalizeManualGradingShortcutKey(value.review) ?? "",
  };
  const error = validateManualGradingShortcuts(normalized);
  if (error) throw new Error(error);
  storage.setItem(
    MANUAL_GRADING_SHORTCUT_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}

export function getManualGradeStateFromShortcut(
  key: string,
  shortcuts: ManualGradingShortcutSettings,
): ManualGradeState | null {
  const normalized = normalizeManualGradingShortcutKey(key);
  if (normalized == null) return null;
  const matchKey = normalized.toLocaleLowerCase("ko-KR");
  if (shortcuts.correct.toLocaleLowerCase("ko-KR") === matchKey) return "correct";
  if (shortcuts.incorrect.toLocaleLowerCase("ko-KR") === matchKey) return "incorrect";
  if (shortcuts.review.toLocaleLowerCase("ko-KR") === matchKey) return "review";
  return null;
}
