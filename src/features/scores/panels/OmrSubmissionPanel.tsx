import { useQuery } from "@tanstack/react-query";
import { fetchSubmission } from "../api/pollingSubmission";
import SubmissionStatusBadge from "../components/SubmissionStatusBadge";

export default function OmrSubmissionPanel({
  submissionId,
}: {
  submissionId: number;
}) {
  const { data } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmission(submissionId),
    refetchInterval: 2000, // ✅ polling only
  });

  if (!data) return null;

  return (
    <div className="card p-4 space-y-2">
      <div className="flex justify-between">
        <div className="font-semibold">
          OMR 제출 #{submissionId}
        </div>
        <SubmissionStatusBadge status={data.status} />
      </div>

      {data.status === "NEEDS_IDENTIFICATION" && (
        <div className="text-sm text-red-600">
          학생 식별이 필요합니다 (휴대폰 번호 기준)
        </div>
      )}

      {data.error_message && (
        <div className="text-sm text-red-500">
          {data.error_message}
        </div>
      )}
    </div>
  );
}
