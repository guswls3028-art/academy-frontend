/**
 * 학부모 로그인 시 "선택한 자녀" ID.
 * - 학생앱 API 호출 시 X-Student-Id 헤더로 전달
 * - localStorage에 저장해 새로고침 후에도 유지
 */
const STORAGE_KEY = "parent_selected_student_id";

let currentId: number | null = null;

export function getParentStudentId(): number | null {
  return currentId;
}

export function setParentStudentId(id: number | null): void {
  currentId = id;
  try {
    if (id != null) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** 자녀 목록 중 유효한 ID가 있으면 localStorage에서 복원, 없으면 첫 번째 자녀 */
export function initParentStudentId(validIds: number[]): number | null {
  if (validIds.length === 0) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const id = parseInt(raw, 10);
      if (Number.isFinite(id) && validIds.includes(id)) {
        currentId = id;
        return id;
      }
    }
  } catch {
    // ignore
  }
  currentId = validIds[0];
  try {
    localStorage.setItem(STORAGE_KEY, String(validIds[0]));
  } catch {
    // ignore
  }
  return validIds[0];
}
