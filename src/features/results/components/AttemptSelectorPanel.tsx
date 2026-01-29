/**
 * PATH: src/features/results/components/AttemptSelectorPanel.tsx
 *
 * ✅ AttemptSelectorPanel (Representative Attempt UX 강화)
 *
 * 변경 사항(운영 필수):
 * 1) 대표 Attempt 변경 성공 시 즉시 반영:
 *    - attempts query invalidate
 *    - 학생 상세(detail) invalidate
 *    - 시험 결과 리스트 invalidate (final_score/passed/clinic_required 갱신)
 * 2) attempt.status unknown 값 → LOCK 처리 (기존 유지)
 * 3) grading 상태 attempt는 선택 불가 (기존 유지)
 *
 * 설계 계약:
 * - 단일 진실 키: enrollment_id
 * - 대표 Attempt 변경 = final_score/passed/clinic_required 재계산 트리거
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Attempt = {
  id: number;
  attempt_index: number;
  is_retake: boolean;
  is_representative: boolean;
  status: string; // ❗ string 그대로 받음
  created_at: string;

  meta?: {
    grading?: {
      total_score?: number;
      total_max_score?: number;
    };
  };
};

type Props = {
  examId: number;
  enrollmentId: number;
  onChanged?: () => void;
};

async function fetchAttempts(examId: number, enrollmentId: number): Promise<Attempt[]> {
  const res = await api.get(`/results/admin/exams/${examId}/enrollments/${enrollmentId}/attempts/`);
  return Array.isArray(res.data) ? res.data : [];
}

async function setRepresentativeAttempt(params: {
  examId: number;
  enrollmentId: number;
  attemptId: number;
}) {
  return api.post(`/results/admin/exams/${params.examId}/representative-attempt/`, {
    enrollment_id: params.enrollmentId,
    attempt_id: params.attemptId,
  });
}

export default function AttemptSelectorPanel({ examId, enrollmentId, onChanged }: Props) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["exam-attempts", examId, enrollmentId],
    queryFn: () => fetchAttempts(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  const changeMut = useMutation({
    mutationFn: setRepresentativeAttempt,

    onSuccess: async () => {
      /**
       * ✅ 핵심: 대표 변경은 아래가 “즉시” 바뀌어야 운영에서 헷갈리지 않는다.
       * - attempts 목록(대표 강조)
       * - 학생 상세(대표 attempt_id/문항/총점)
       * - 시험 리스트(final_score/passed/clinic_required)
       */
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["exam-attempts", examId, enrollmentId] }),
        qc.invalidateQueries({ queryKey: ["admin-exam-detail", examId, enrollmentId] }),
        qc.invalidateQueries({ queryKey: ["admin-exam-results", examId] }),
      ]);

      onChanged?.();
    },

    onError: (e: any) => {
      alert(e?.response?.data?.detail || "대표 attempt 변경 실패");
    },
  });

  if (q.isLoading) {
    return <div className="px-4 py-2 text-xs text-gray-500">Attempt 불러오는 중...</div>;
  }

  if (q.isError) {
    return <div className="px-4 py-2 text-xs text-red-600">Attempt 조회 실패</div>;
  }

  const attempts = q.data ?? [];

  return (
    <div className="border-b bg-gray-50 px-4 py-3">
      <div className="mb-2 text-xs font-semibold text-gray-700">Attempt 선택</div>

      <div className="flex flex-wrap gap-2">
        {attempts.map((a) => {
          const raw = String(a.status).toLowerCase();
          const isKnown = ["pending", "grading", "done", "failed"].includes(raw);
          const isLocked = raw === "grading" || !isKnown;
          const isActive = a.is_representative;

          // ✅ "미채점" 보조 UX: done인데 meta 점수 없으면 운영상 위험 신호
          const gradingScore = a.meta?.grading?.total_score;
          const gradingMax = a.meta?.grading?.total_max_score;
          const isUngradedHint =
            raw === "done" &&
            (gradingScore === undefined || gradingScore === null || gradingMax === undefined || gradingMax === null);

          return (
            <button
              key={a.id}
              type="button"
              disabled={isLocked || isActive || changeMut.isPending}
              onClick={() =>
                changeMut.mutate({
                  examId,
                  enrollmentId,
                  attemptId: a.id,
                })
              }
              className={[
                "rounded border px-3 py-1 text-xs",
                isActive ? "border-blue-600 bg-blue-50 font-semibold" : "border-gray-300 bg-white",
                isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              ].join(" ")}
              title={
                !isKnown
                  ? "알 수 없는 상태 (잠김)"
                  : raw === "grading"
                    ? "채점 중인 attempt는 선택할 수 없습니다"
                    : isActive
                      ? "현재 대표 attempt"
                      : "대표 attempt로 설정"
              }
            >
              #{a.attempt_index}
              {a.is_retake && <span className="ml-1 text-[10px] text-orange-600">재시험</span>}
              {isLocked && <span className="ml-1 text-[10px] text-red-600">잠김</span>}
              {isUngradedHint && <span className="ml-1 text-[10px] text-blue-700">미채점</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
