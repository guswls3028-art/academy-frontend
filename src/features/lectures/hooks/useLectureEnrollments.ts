// PATH: src/features/lectures/hooks/useLectureEnrollments.ts
import { useQuery } from "@tanstack/react-query";
import { fetchLectureEnrollments } from "../api/enrollments";

export function useLectureEnrollments(lectureId: number) {
  return useQuery({
    queryKey: ["lecture-enrollments", lectureId],
    queryFn: () => fetchLectureEnrollments(lectureId),
    enabled: !!lectureId,
  });
}
