// src/student/pages/GradePage.tsx

import { Link } from "react-router-dom";

export default function GradePage() {
  // 예시 데이터
  const exams = [
    { id: 1, title: "중간고사" },
    { id: 2, title: "기말고사" },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">성적</h2>

      {exams.map((exam) => (
        <div
          key={exam.id}
          className="flex items-center justify-between rounded border p-3"
        >
          <div>{exam.title}</div>

          <Link
            to={`/student/exams/${exam.id}/result`}
            className="text-sm text-blue-600 hover:underline"
          >
            결과 보기
          </Link>
        </div>
      ))}
    </div>
  );
}
