import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import type { StaffRoom } from "./staffMenu";

export const alertEndpoint = "/students/teacher-alerts/";
export const queueKey = ["dawon", "learning-alert-queue"] as const;
export function useAlertSummary(role:StaffRoom | null) {
  return useQuery({
    queryKey:[...queueKey, role, "summary"], enabled:!!role, staleTime:60_000, refetchInterval:120_000,
    queryFn:async ({signal}) => (await api.get<{pending:number;by_group:Record<string,number>}>(alertEndpoint, {
      params:{queue:"summary"}, signal,
    })).data,
  });
}

export const alertRules = {
  absence_streak: { label: "연속 결석", unit: "회 이상" },
  homework_missing: { label: "과제 누적 미제출", unit: "건 이상" },
  exam_drop: { label: "시험 점수 하락", unit: "%p 이상" },
  recent_exam_drop: { label: "직전 3회 평균 대비 하락", unit: "%p 이상" },
  top_reference_gap: { label: "반 상위 평균 대비 부족", unit: "%p 이상" },
  exam_rise: { label: "시험 점수 상승", unit: "%p 이상" },
  homework_drop: { label: "과제 점수 하락", unit: "%p 이상" },
  video_watch: { label: "배정 영상 시청 부족", unit: "% 미만" },
} as const;
