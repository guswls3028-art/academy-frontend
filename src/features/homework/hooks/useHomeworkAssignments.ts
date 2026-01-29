// PATH: src/features/homework/hooks/useHomeworkAssignments.ts
/**
 * useHomeworkAssignments
 * - 과제 대상 학생(선택 상태 포함) 단일 진실 query
 */

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../queryKeys";
import { fetchHomeworkAssignments } from "../api/homeworkAssignments";

export function useHomeworkAssignments(homeworkId: number) {
  const hid = Number(homeworkId);
  const enabled = Number.isFinite(hid) && hid > 0;

  return useQuery({
    queryKey: QUERY_KEYS.HOMEWORK_ASSIGNMENTS(hid),
    queryFn: () => fetchHomeworkAssignments(hid),
    enabled,
    // UX: 페이지 다시 들어왔을 때 "0명" 같은 깜빡임 줄이기
    staleTime: 10_000,
  });
}
