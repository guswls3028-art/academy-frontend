// PATH: src/features/materials/components/TemplateMaterialEditorModal.MetaPreviewTab.tsx
// WHY:
// OMR 채점 엔진이 소비하는 구조 정보(meta)를 운영자가 직접 확인할 수 있게 한다.
// PDF와 1:1 대응되는 데이터임을 명확히 하여 오해를 방지한다.
// 읽기 전용, 복사 가능, 수정 불가가 핵심이다.

import { useEffect, useState } from "react";

export function MetaPreviewTab() {
  const [questionCount, setQuestionCount] = useState<number>(10);
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
        if (alive) setError(e.message || "meta 조회 실패");
      }
    })();
    return () => {
      alive = false;
    };
  }, [questionCount]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[10, 20, 30].map((qc) => (
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
        이 정보는 OMR 채점 엔진이 사용하는 구조 정보입니다. 수정할 수 없습니다.
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
