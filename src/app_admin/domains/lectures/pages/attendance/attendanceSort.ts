import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";

export const DEFAULT_ATTENDANCE_SORT = "name";
const ATTENDANCE_SORT_VALUES = ["name", "-name", "parent_phone", "-parent_phone", "phone", "-phone"] as const;
export type AttendanceSort = typeof ATTENDANCE_SORT_VALUES[number];
export type AttendanceSortColumn = "name" | "parent_phone" | "phone";

function isAttendanceSort(value: string | null): value is AttendanceSort {
  return ATTENDANCE_SORT_VALUES.includes(value as AttendanceSort);
}

export function getStoredAttendanceSort(
  storageKey: string | null,
  previousStorageKey: string | null,
): AttendanceSort {
  if (!storageKey || typeof window === "undefined") return DEFAULT_ATTENDANCE_SORT;
  try {
    let savedSort = getLocalItem(storageKey);
    if (!savedSort && previousStorageKey) {
      savedSort = getLocalItem(previousStorageKey);
      if (isAttendanceSort(savedSort)) {
        setLocalItem(storageKey, savedSort);
        if (getLocalItem(storageKey) === savedSort) removeLocalItem(previousStorageKey);
      }
    }
    const resolvedSort = isAttendanceSort(savedSort) ? savedSort : DEFAULT_ATTENDANCE_SORT;
    if (savedSort !== resolvedSort) setLocalItem(storageKey, resolvedSort);
    return resolvedSort;
  } catch {
    return DEFAULT_ATTENDANCE_SORT;
  }
}
