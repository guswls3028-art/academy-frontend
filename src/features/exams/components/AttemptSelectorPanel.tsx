import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Attempt = {
  id: number;
  attempt_index: number;
  is_representative: boolean;
  score: number | null;
};

export default function AttemptSelectorPanel({
  examId,
  enrollmentId,
}: {
  examId: number;
  enrollmentId: number;
}) {
  const q = useQuery({
    queryKey: ["attempts", examId, enrollmentId],
    queryFn: async () => {
      const res = await api.get(
        `/results/admin/exams/${examId}/enrollments/${enrollmentId}/attempts/`
      );
      return res.data as Attempt[];
    },
    enabled:
      Number.isFinite(examId) &&
      Number.isFinite(enrollmentId),
  });

  if (q.isLoading) return <div>로딩...</div>;
  if (q.isError) return <div>조회 실패</div>;

  return (
    <div className="space-y-2">
      {q.data?.map((a) => (
        <div
          key={a.id}
          className="border rounded px-3 py-2 text-sm"
        >
          Attempt #{a.attempt_index} · 점수: {a.score ?? "-"}{" "}
          {a.is_representative && "⭐"}
        </div>
      ))}
    </div>
  );
}
