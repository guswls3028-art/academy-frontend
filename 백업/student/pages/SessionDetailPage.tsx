// src/student/pages/SessionDetailPage.tsx

import { Link, useParams } from "react-router-dom";

export default function SessionDetailPage() {
  const { sessionId } = useParams();

  // ⚠️ 실제로는 session API에서 examId를 받아오는 게 정석
  // 지금은 예시로 고정
  const examId = 1;

  return (
    <div className="space-y-4">
      <h2>차시 상세</h2>

      <Link
        to={`/student/media?session=${sessionId}`}
        className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
      >
        영상 보기
      </Link>

      {/* ✅ 시험 결과 보기 */}
      <Link
        to={`/student/exams/${examId}/result`}
        className="inline-block rounded border px-4 py-2 text-sm hover:bg-gray-50"
      >
        시험 결과 보기
      </Link>
    </div>
  );
}
