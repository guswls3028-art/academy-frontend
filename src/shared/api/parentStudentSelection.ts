/**
 * 현재 브라우저 탭에서 학부모가 명시적으로 선택한 자녀 ID.
 *
 * 선택은 API 요청 헤더와 화면이 함께 쓰는 단일 상태다. 저장값은 테넌트와
 * 학부모 사용자별로 격리하며, 다자녀 계정은 저장된 유효 선택이 없으면 반드시
 * 사용자가 자녀를 고른 뒤 학생 범위 요청을 시작한다.
 */
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

const STORAGE_KEY_PREFIX = "parent_selected_student_id";

function storageKey(parentUserId: number): string | null {
  const tenantCode = getTenantCodeForApiRequest();
  return tenantCode ? `${STORAGE_KEY_PREFIX}_${tenantCode}_${parentUserId}` : null;
}

function legacyStorageKey(): string | null {
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

export function setParentStudentId(id: number | null, parentUserId: number): void {
  currentId = id;
  try {
    const legacyKey = legacyStorageKey();
    if (legacyKey) removeLocalItem(legacyKey);
    const key = storageKey(parentUserId);
    if (!key) return;
    if (id != null) {
      setLocalItem(key, String(id));
    } else {
      removeLocalItem(key);
    }
  } catch {
    // localStorage를 사용할 수 없어도 현재 탭의 명시 선택은 유지한다.
  }
}

/** 인증 세션만 끝낼 때 저장된 사용자 선택은 남기고 현재 탭 상태만 비운다. */
export function resetParentStudentIdInMemory(): void {
  currentId = null;
}

/**
 * 저장된 유효 선택을 복원한다. 자녀가 한 명이면 그 자녀만 확정할 수 있으므로
 * 자동 선택하고, 여러 명인데 유효한 저장 선택이 없으면 null을 반환한다.
 */
export function initParentStudentId(validIds: number[], parentUserId: number): number | null {
  currentId = null;
  try {
    // 과거 테넌트 공용 키에는 암묵적인 첫 자녀 선택도 저장되어 있어 재사용하지 않는다.
    const legacyKey = legacyStorageKey();
    if (legacyKey) removeLocalItem(legacyKey);

    const key = storageKey(parentUserId);
    const raw = key ? getLocalItem(key) : null;
    if (raw) {
      const id = Number.parseInt(raw, 10);
      if (Number.isFinite(id) && validIds.includes(id)) {
        currentId = id;
        return id;
      }
      if (key) removeLocalItem(key);
    }
  } catch {
    // 저장소 오류는 다자녀 자동 선택의 근거로 사용하지 않는다.
  }

  if (validIds.length !== 1) return null;
  setParentStudentId(validIds[0], parentUserId);
  return validIds[0];
}
