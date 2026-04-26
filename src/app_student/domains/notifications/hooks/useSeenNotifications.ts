/**
 * localStorage 기반 알림 읽음 처리
 * - 알림 페이지 방문 시 현재 알림 ID들을 "seen"으로 저장
 * - 카운트 계산 시 seen ID를 제외하여 배지 숫자 갱신
 * - 30일 지난 항목은 자동 정리
 *
 * 자녀 격리: 학부모 멀티자녀 환경에서는 자녀별 X-Student-Id로 키 스코프 분리.
 * 그렇지 않으면 자녀 전환 시 in-memory cache(_seenCache)와 storage entry가 섞여
 * 다른 자녀의 seen 상태가 잠깐 노출될 수 있음 (ID 자체는 글로벌 unique지만
 * 캐시 무효화 타이밍 + UX 일관성 차원에서 분리).
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveTenantCodeString } from "@/shared/tenant";
import { getParentStudentId } from "@student/shared/api/parentStudentSelection";

const STORAGE_KEY_PREFIX = "stu:seen-notifications";
const LEGACY_STORAGE_KEY = "stu:seen-notifications";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일

type SeenEntry = { id: string; at: number };

function storageKey(): string {
  const tc = resolveTenantCodeString();
  const sid = getParentStudentId();
  return sid != null ? `${STORAGE_KEY_PREFIX}:${tc}:${sid}` : `${STORAGE_KEY_PREFIX}:${tc}`;
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

function loadSeen(): SeenEntry[] {
  cleanupLegacyKey();
  const now = Date.now();
  const key = storageKey();
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

function saveSeen(entries: SeenEntry[]) {
  const key = storageKey();
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
export function isNotificationSeen(type: string, id: number | string): boolean {
  const key = `${type}:${id}`;
  return loadSeen().some((e) => e.id === key);
}

/** 현재 알림 목록의 seen 필터링된 카운트 반환 */
export function getUnseenCount(type: string, ids: (number | string)[]): number {
  const seen = new Set(loadSeen().map((e) => e.id));
  return ids.filter((notificationId) => !seen.has(`${type}:${notificationId}`)).length;
}

/** 알림 페이지에서 사용: 현재 보이는 알림들을 seen으로 마킹 + 카운트 갱신 */
export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient();

  return useCallback(
    (items: { type: string; id: number | string }[]) => {
      if (items.length === 0) return;
      const existing = loadSeen();
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
        saveSeen(existing);
        // 카운트 쿼리 무효화 → 배지 숫자 즉시 갱신
        queryClient.invalidateQueries({ queryKey: ["student", "notifications", "counts"] });
      }
    },
    [queryClient],
  );
}
