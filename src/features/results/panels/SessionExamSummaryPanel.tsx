// PATH: src/features/results/panels/SessionExamSummaryPanel.tsx
//
// ✅ SessionExamSummaryPanel
//
// 책임:
// - Session 단위 시험별 성적 요약 표시
// - examId는 "선택 상태 표시용" UI 정보
//
// ❌ 금지:
// - 단일 학생 접근
// - 결과 계산 / 합불 판단
//
// 🔒 설계 원칙:
// - session = 집계 기준
// - exam = drill-down 대상

import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  sessionId: number;
  activeExamId?: number;
};

type SessionExamSummaryRow = {
  exam_id: number;
  title: string;

  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;

  pass_count: number;
  fail_count: number;
  pass_rate: number;

  clinic_count: number;
};

type SessionExamsSummaryResponse = {
  session_id: number;
  exams: SessionExamSummaryRow[];
};

async function fetchSessionExamsSummary(
  sessionId: number
): Promise<SessionExamsSummaryResponse> {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/exams/summary/`
  );
  return res.data;
}

export default function SessionExamSummaryPanel({
  sessionId,
  activeExamId,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-exams-summary", sessionId],
    queryFn: () => fetchSessionExamsSummary(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">성적 요약 불러오는 중...</div>;
  }

  if (isError || !data) {
    return <div className="text-sm text-red-600">성적 요약 실패</div>;
  }

  if (!data.exams || data.exams.length === 0) {
    return <div className="text-sm text-gray-500">성적 데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">시험별 성적 요약</h3>

      <table className="w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-2 py-1 text-left">시험</th>
            <th className="border px-2 py-1">응시</th>
            <th className="border px-2 py-1">평균</th>
            <th className="border px-2 py-1">최저</th>
            <th className="border px-2 py-1">최고</th>
            <th className="border px-2 py-1">합격률</th>
            <th className="border px-2 py-1">클리닉</th>
          </tr>
        </thead>

        <tbody>
          {data.exams.map((row) => {
            const isActive = row.exam_id === activeExamId;

            return (
              <tr
                key={row.exam_id}
                className={isActive ? "bg-blue-50" : ""}
              >
                <td className="border px-2 py-1 font-medium">
                  {row.title}
                </td>
                <td className="border px-2 py-1 text-center">
                  {row.participant_count}
                </td>
                <td className="border px-2 py-1 text-center">
                  {row.avg_score.toFixed(1)}
                </td>
                <td className="border px-2 py-1 text-center">
                  {row.min_score}
                </td>
                <td className="border px-2 py-1 text-center">
                  {row.max_score}
                </td>
                <td className="border px-2 py-1 text-center">
                  {(row.pass_rate * 100).toFixed(1)}%
                </td>
                <td className="border px-2 py-1 text-center">
                  {row.clinic_count}
                </td>
