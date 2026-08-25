import { getTenantLocalItem, setTenantLocalItem } from "@/shared/utils/safeLocalStorage";

const SAVED_LOCATIONS_KEY = "academy-clinic-saved-locations";

export function getSavedLocations(): string[] {
  try {
    const raw = getTenantLocalItem(SAVED_LOCATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveLocationToStorage(name: string): string[] {
  const trimmed = (name || "").trim();
  if (!trimmed) return getSavedLocations();
  const list = getSavedLocations();
  if (list.includes(trimmed)) return list;
  const next = [...list, trimmed];
  setTenantLocalItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}

export function removeSavedLocation(name: string): string[] {
  const list = getSavedLocations().filter((x) => x !== name);
  setTenantLocalItem(SAVED_LOCATIONS_KEY, JSON.stringify(list));
  return list;
}
