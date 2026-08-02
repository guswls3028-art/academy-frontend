/**
 * localStorage 기반 알림 읽음 처리
 * - 알림 페이지 방문 시 현재 알림 ID들을 "seen"으로 저장
 * - 카운트 계산 시 seen ID를 제외하여 배지 숫자 갱신
 * - 30일 지난 항목은 자동 정리
 *
 * 사용자 격리: 학부모는 선택 자녀 ID, 학생은 본인 프로필 ID로 키 스코프 분리.
 * 공용 기기에서 자녀 전환 또는 계정 전환 시 동일 알림 ID의 읽음 상태가 섞이지 않는다.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveTenantCodeString } from "@/shared/tenant";
import { getParentStudentId } from "@student/shared/api/parentStudentSelection";
import { studentQueryKeys } from "@student/shared/api/queryKeys";

const STORAGE_KEY_PREFIX = "stu:seen-notifications";
const LEGACY_STORAGE_KEY = "stu:seen-notifications";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일

type SeenEntry = { id: string; at: number };

function storageKey(profileId?: number | null): string {
  const tc = resolveTenantCodeString();
  const sid = getParentStudentId();
  const scopeId = sid ?? (typeof profileId === "number" && Number.isFinite(profileId) ? profileId : null);
  return scopeId != null
    ? `${STORAGE_KEY_PREFIX}:${tc}:${scopeId}`
    : `${STORAGE_KEY_PREFIX}:${tc}:unknown`;
}

// 이전 글로벌 키(stu:seen-notifications) 정리 — 자녀별 분리 전 버전에서 사용. 1회성.
let _legacyKeyCleaned = false;
function cleanupLegacyKey(): void {
  if (_legacyKeyCleaned) return;
  _legacyKeyCleaned = true;
  try {
    // 새 키 형식과 정확히 일치하지 않을 때만 제거 (storageKey()와 LEGACY가 같아질 일은 없지만 방어).
    const current = storageKey();
    if (current !== LEGACY_STORAGE_KEY) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** 캐시: 동일 이벤트 루프 틱 내 반복 파싱 방지. 자녀 전환 시 키가 바뀌면 무효. */
let _seenCache: SeenEntry[] | null = null;
let _seenCacheKey = "";
let _seenCacheTime = 0;
const CACHE_TTL_MS = 500; // 500ms 캐시

function loadSeen(profileId?: number | null): SeenEntry[] {
  cleanupLegacyKey();
  const now = Date.now();
  const key = storageKey(profileId);
  if (_seenCache && _seenCacheKey === key && now - _seenCacheTime < CACHE_TTL_MS) return _seenCache;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { _seenCache = []; _seenCacheKey = key; _seenCacheTime = now; return []; }
    const entries: SeenEntry[] = JSON.parse(raw);
    const cutoff = now - MAX_AGE_MS;
    _seenCache = entries.filter((e) => e.at > cutoff);
    _seenCacheKey = key;
    _seenCacheTime = now;
    return _seenCache;
  } catch {
    _seenCache = [];
    _seenCacheKey = key;
    _seenCacheTime = now;
    return [];
  }
}

function saveSeen(entries: SeenEntry[], profileId?: number | null) {
  const key = storageKey(profileId);
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    _seenCache = entries;
    _seenCacheKey = key;
    _seenCacheTime = Date.now();
  } catch {
    // storage full — ignore
  }
}

/** 특정 ID가 이미 seen인지 확인 */
export function isNotificationSeen(
  type: string,
  id: number | string,
  profileId?: number | null,
): boolean {
  const key = `${type}:${id}`;
  return loadSeen(profileId).some((e) => e.id === key);
}

/** 현재 알림 목록의 seen 필터링된 카운트 반환 */
export function getUnseenCount(
  type: string,
  ids: (number | string)[],
  profileId?: number | null,
): number {
  const seen = new Set(loadSeen(profileId).map((e) => e.id));
  return ids.filter((notificationId) => !seen.has(`${type}:${notificationId}`)).length;
}

/** 알림 페이지에서 사용: 현재 보이는 알림들을 seen으로 마킹 + 카운트 갱신 */
export function useMarkNotificationsSeen(profileId?: number | null) {
  const queryClient = useQueryClient();

  return useCallback(
    (items: { type: string; id: number | string }[]) => {
      if (items.length === 0) return;
      const existing = loadSeen(profileId);
      const existingSet = new Set(existing.map((e) => e.id));
      const now = Date.now();
      let changed = false;

      for (const item of items) {
        const key = `${item.type}:${item.id}`;
        if (!existingSet.has(key)) {
          existing.push({ id: key, at: now });
          existingSet.add(key);
          changed = true;
        }
      }

      if (changed) {
        saveSeen(existing, profileId);
        // 카운트 쿼리 무효화 → 배지 숫자 즉시 갱신
        queryClient.invalidateQueries({ queryKey: studentQueryKeys.notificationCounts });
      }
    },
    [profileId, queryClient],
  );
}
