type Props = {
  status: string;
};

export default function SubmissionStatusBadge({ status }: Props) {
  const base =
    "inline-flex rounded px-2 py-0.5 text-xs font-semibold";

  switch (status) {
    case "PROCESSING":
      return <span className={`${base} bg-blue-100 text-blue-700`}>AI 처리중</span>;
    case "ANSWERS_READY":
      return <span className={`${base} bg-amber-100 text-amber-700`}>답안 확인</span>;
    case "NEEDS_IDENTIFICATION":
      return <span className={`${base} bg-red-100 text-red-700`}>식별 필요</span>;
    case "GRADED":
      return <span className={`${base} bg-emerald-100 text-emerald-700`}>채점 완료</span>;
    case "FAILED":
      return <span className={`${base} bg-gray-200 text-gray-600`}>실패</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-500`}>{status}</span>;
  }
}
