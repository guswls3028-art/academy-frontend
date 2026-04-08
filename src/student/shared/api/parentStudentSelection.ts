/**
 * 학부모 로그인 시 "선택한 자녀" ID.
 * - 학생앱 API 호출 시 X-Student-Id 헤더로 전달
 * - localStorage에 저장해 새로고침 후에도 유지
 * - 테넌트별로 분리하여 크로스 테넌트 오염 방지
 */
import { resolveTenantCodeString } from "@/shared/tenant";

const STORAGE_KEY_PREFIX = "parent_selected_student_id";

function storageKey(): string {
  const tc = resolveTenantCodeString();
  return `${STORAGE_KEY_PREFIX}_${tc}`;
}

let currentId: number | null = null;

export function getParentStudentId(): number | null {
  return currentId;
}

export function setParentStudentId(id: number | null): void {
  currentId = id;
  try {
    const key = storageKey();
    if (id != null) {
      localStorage.setItem(key, String(id));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** 자녀 목록 중 유효한 ID가 있으면 localStorage에서 복원, 없으면 첫 번째 자녀 */
export function initParentStudentId(validIds: number[]): number | null {
  if (validIds.length === 0) return null;
  try {
    const raw = localStorage.getItem(storageKey());
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
    localStorage.setItem(storageKey(), String(validIds[0]));
  } catch {
    // ignore
  }
  return validIds[0];
}
