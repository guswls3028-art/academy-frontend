// src/features/lectures/pages/scores/SessionScoresTable.tsx
/**
 * ✅ SessionScoresTable (ENTRY PAGE)
 *
 * 책임:
 * - sessionId 라우팅 파싱
 * - 세션 단위 시험 요약 표시 (viewer)
 * - 실제 성적 테이블은 scores 도메인에 위임
 *
 * ❌ 학생별 점수 렌더 ❌
 * ❌ mock 데이터 ❌
 * ❌ 점수 입력 ❌
 */

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";

// ------------------------------------------------------------
// Types (요약용)
// ------------------------------------------------------------

type SessionExamSummary = {
  exam_id: number;
  title: string;
  pass_score: number;

  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;

  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

type SessionExamsSummaryResponse = {
  session_id: number;
  participant_count: number;
  pass_rate: number;
  clinic_rate: number;

  strategy: string;
  pass_source: string;

  exams: SessionExamSummary[];
};

// ------------------------------------------------------------
// API (viewer only)
// ------------------------------------------------------------

async function fetchSessionExamsSummary(
  sessionId: number
): Promise<SessionExamsSummaryResponse> {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/exams/summary/`
  );
  return res.data;
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export default function SessionScoresTable() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);

  const { data, isLoading } = useQuery({
    queryKey: ["session-exams-summary", numericSessionId],
    queryFn: () => fetchSessionExamsSummary(numericSessionId),
    enabled: Number.isFinite(numericSessionId),
  });

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="text-sm text-red-600">
        유효하지 않은 sessionId 입니다.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">
        세션 성적 정보 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===================== */}
      {/* Session Exam Summary */}
      {/* ===================== */}
      {data && data.exams.length > 0 ? (
        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">
            세션 시험 요약
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {data.exams.map((exam) => (
              <div
                key={exam.exam_id}
                className="rounded border px-3 py-2"
              >
                <div className="font-medium">
                  {exam.title}
                </div>
                <div>
                  평균 {exam.avg_score} ·
                  합격률 {exam.pass_rate}%
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded border bg-gray-50 p-6 text-sm text-gray-500">
          이 세션에는 성적 대상 시험이 없습니다.
        </div>
      )}

      {/* ===================== */}
      {/* Scores Domain Entry */}
      {/* ===================== */}
      <SessionScoresPanel sessionId={numericSessionId} />
    </div>
  );
}
