// PATH: src/student/pages/StudentExamResultPage.tsx
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";

import PageContainer from "@/layouts/default/PageContainer";
import { PageHeader } from "@/shared/ui/layout";


import { useMyExamResult } from "@/features/results/hooks/useMyExamResult";

/**
 * ✅ Step 4-2) “클리닉 안내”를 결과 페이지에 녹이는 핵심 원칙
 * - 학생 화면에서 clinic_required를 "직접 계산"하지 않는다 (원칙)
 * - 가능하면 백엔드가 clinic_required 내려주는 구조가 정답
 *
 * 다만 백엔드가 아직 clinic_required를 안 내려주면:
 * - (임시/보조) total_score / max_score 기반으로만 안내 배너를 띄울 수 있음
 * - 단, 기준이 바뀌면 프론트도 같이 바뀌는 위험이 있으니 “보조”로만 사용
 */

export default function StudentExamResultPage() {
  const { examId } = useParams(); // string | undefined

  // ✅ URL 파라미터 → number 변환 (안전)
  const safeExamId = useMemo(() => {
    const n = Number(examId);
    return Number.isFinite(n) ? n : undefined;
  }, [examId]);

  // ✅ React Query (enabled 방어 포함)
  const { data, isLoading, isError } = useMyExamResult(safeExamId);

  // ✅ examId가 깨졌을 때: 요청 자체도 안 나가고 명확한 UI
  if (!safeExamId) {
    return (
      <PageContainer>
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          잘못된 시험 ID입니다. (URL 확인 필요)
        </div>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          성적을 불러오는 중...
        </div>
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer>
        <div className="rounded border bg-white p-4 text-sm text-red-600">
          성적 조회에 실패했습니다. (아직 채점 전이거나 권한/데이터가 없을 수 있어요)
        </div>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------
  // ✅ Step 4-2) 클리닉 안내 로직
  // 1) 백엔드가 clinic_required를 내려주면 그 값을 "절대 우선"
  // 2) 없으면(현재 단계) 보조 판정(임시) 가능
  // ------------------------------------------------------------
  const clinicRequired =
    typeof data.clinic_required === "boolean"
      ? data.clinic_required
      : false; // ✅ 보조판정은 여기서 true로 만들 수도 있지만, 원칙상 false 유지(권장)

  const passed =
    typeof data.passed === "boolean"
      ? data.passed
      : null; // 모르면 null

  return (
    <PageContainer>
      <PageHeader
        title="시험 결과"
        actions={
          <Link
            to="/student" // ✅ 학생 홈/목록 경로에 맞게 수정
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          >
            목록으로
          </Link>
        }
      />

      {/* ===================== 요약 카드 ===================== */}
      <div className="mt-4 rounded border bg-white p-4">
        <div className="text-sm text-gray-500">총점</div>

        <div className="mt-1 flex items-end gap-2">
          <div className="text-2xl font-semibold">
            {data.total_score} / {data.max_score}
          </div>

          {/* ✅ passed가 내려오면 배지로 표시 */}
          {passed !== null && (
            <span
              className={
                "mb-1 rounded-full px-2 py-1 text-xs font-medium " +
                (passed
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700")
              }
            >
              {passed ? "통과" : "미통과"}
            </span>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-500">
          제출 시각: {data.submitted_at ?? "-"}
        </div>
      </div>

      {/* ===================== Step 4-2) 클리닉 안내 ===================== */}
      {clinicRequired && (
        <div className="mt-4 rounded border border-purple-300 bg-purple-50 p-4">
          <div className="text-sm font-semibold text-purple-800">
            📌 클리닉 대상 안내
          </div>
          <p className="mt-1 text-sm text-purple-700">
            이번 시험 결과를 바탕으로 클리닉 대상자로 선정되었습니다.
            담당 선생님과의 보충 학습이 예정되어 있습니다.
          </p>
        </div>
      )}

      {/* ===================== 문항별 결과 ===================== */}
      <div className="mt-4 overflow-hidden rounded border bg-white">
        <div className="border-b bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          문항별 결과
        </div>

        <table className="w-full text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">문항</th>
              <th className="px-4 py-2 text-left">정오</th>
              <th className="px-4 py-2 text-left">점수</th>
              <th className="px-4 py-2 text-left">내 답</th>
            </tr>
          </thead>

          <tbody>
            {data.items.map((it) => (
              <tr key={it.question_id} className="border-b last:border-b-0">
                <td className="px-4 py-2">Q{it.question_id}</td>

                <td className="px-4 py-2">
                  {it.is_correct ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      정답
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      오답
                    </span>
                  )}
                </td>

                <td className="px-4 py-2">
                  {it.score} / {it.max_score}
                </td>

                <td className="px-4 py-2 text-gray-700">
                  {it.answer?.trim() ? it.answer : "-"}
                </td>
              </tr>
            ))}

            {data.items.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-gray-400" colSpan={4}>
                  문항별 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== Step 4-3) (선택) 신뢰도/판정 UI 자리 ===================== */}
      {/* 
        나중에 backend가 low_confidence 같은 걸 내려주면 아래 블록을 활성화하면 됨.
        예: data.low_confidence === true
      */}
      {/* 
      {data.low_confidence && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ 일부 응답의 신뢰도가 낮아 점수가 조정될 수 있습니다.
        </div>
      )} 
      */}
    </PageContainer>
  );
}
