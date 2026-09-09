/**
 * 학부모 로그인 시 "선택한 자녀" ID.
 * - 학생앱 API 호출 시 X-Student-Id 헤더로 전달
 * - localStorage에 저장해 새로고침 후에도 유지
 * - 테넌트별로 분리하여 크로스 테넌트 오염 방지
 */
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

const STORAGE_KEY_PREFIX = "parent_selected_student_id";

function storageKey(): string | null {
  const tenantCode = getTenantCodeForApiRequest();
  return tenantCode ? `${STORAGE_KEY_PREFIX}_${tenantCode}` : null;
}

let currentId: number | null = null;

export function isStudentScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  if (typeof head !== "string") return false;
  return (
    head === "student" ||
    head.startsWith("student-") ||
    head === "video-comments" ||
    head === "storage-quota"
  );
}

export function getParentStudentId(): number | null {
  return currentId;
}

export function setParentStudentId(id: number | null): void {
  currentId = id;
  try {
    const key = storageKey();
    if (!key) return;
    if (id != null) {
      setLocalItem(key, String(id));
    } else {
      removeLocalItem(key);
    }
  } catch {
    // ignore
  }
}

/** 인증 세션만 끝낼 때 테넌트별 사용자 선호는 남기고 현재 탭의 선택만 비운다. */
export function resetParentStudentIdInMemory(): void {
  currentId = null;
}

/** 자녀 목록 중 유효한 ID가 있으면 localStorage에서 복원, 없으면 첫 번째 자녀 */
export function initParentStudentId(validIds: number[]): number | null {
  if (validIds.length === 0) return null;
  try {
    const key = storageKey();
    const raw = key ? getLocalItem(key) : null;
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
    const key = storageKey();
    if (key) setLocalItem(key, String(validIds[0]));
  } catch {
    // ignore
  }
  return validIds[0];
}
