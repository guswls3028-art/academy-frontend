import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

/**
 * 세션 기준으로
 * - 현재 로그인한 학생의 enrollment_id 조회
 * - 없으면 null
 */
export function useStudentEnrollmentBySession(sessionId: number) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-enrollment-by-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const res = await api.get("/enrollments/me/", {
        params: { session: sessionId },
        withCredentials: true,
      });

      return res.data; // { id, enrollment_id, ... }
    },
    enabled: !!sessionId,
  });

  return {
    enrollmentId: data?.id ?? null,
    loading: isLoading,
    error,
  };
}
