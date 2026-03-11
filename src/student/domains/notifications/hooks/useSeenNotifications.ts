/**
 * localStorage 기반 알림 읽음 처리
 * - 알림 페이지 방문 시 현재 알림 ID들을 "seen"으로 저장
 * - 카운트 계산 시 seen ID를 제외하여 배지 숫자 갱신
 * - 30일 지난 항목은 자동 정리
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "stu:seen-notifications";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일

type SeenEntry = { id: string; at: number };

function loadSeen(): SeenEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: SeenEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    return entries.filter((e) => e.at > cutoff);
  } catch {
    return [];
  }
}

function saveSeen(entries: SeenEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
  return ids.filter((id) => !seen.has(`${type}:${id}`)).length;
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
