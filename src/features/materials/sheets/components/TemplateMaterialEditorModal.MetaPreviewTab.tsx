// PATH: src/features/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx
// SSOT ALIGN:
// - exams는 meta를 직접 생성하지 않고(코멘트 기준) assets의 objective_v1 meta를 참조한다.
// - 프론트는 meta를 "가공/추정"하지 않고 그대로 보여준다.
// - exams generate-omr/question_auto는 10|20|30 스펙에 맞춘다.

import { useEffect, useState } from "react";

const QUESTION_COUNTS = [10, 20, 30] as const;

export function MetaPreviewTab() {
  const [questionCount, setQuestionCount] = useState<(typeof QUESTION_COUNTS)[number]>(20);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        const res = await fetch(
          `/api/v1/assets/omr/objective/meta/?question_count=${questionCount}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setError(e?.message || "meta 조회 실패");
      }
    })();
    return () => {
      alive = false;
    };
  }, [questionCount]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {QUESTION_COUNTS.map((qc) => (
          <button
            key={qc}
            onClick={() => setQuestionCount(qc)}
            className={`px-2 py-1 border rounded ${
              questionCount === qc ? "bg-black text-white" : ""
            }`}
          >
            {qc}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        이 정보는 백엔드가 반환하는 OMR 메타데이터 원본입니다. 프론트에서 수정하지 않습니다.
      </p>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-[400px]">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
