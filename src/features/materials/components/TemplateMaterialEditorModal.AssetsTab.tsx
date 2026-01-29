// PATH: src/features/materials/components/TemplateMaterialEditorModal.AssetsTab.tsx
// WHY:
// OMR PDF 생성에 필요한 최소 입력(question_count, logo)만 받아
// assets 도메인의 stateless PDF API를 호출한다.
// 실패/성공 상태를 명확히 드러내어 운영자 사고를 줄인다.

import { useState } from "react";

const QUESTION_COUNTS = [10, 20, 30] as const;

export function AssetsTab() {
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = questionCount !== null && !loading;

  const downloadPdf = async () => {
    if (!questionCount) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("question_count", String(questionCount));
      if (logo) fd.append("logo", logo);

      const res = await fetch("/api/v1/assets/omr/objective/pdf/", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (e: any) {
      alert(e.message || "PDF 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm">문항 수</label>
        {QUESTION_COUNTS.map((qc) => (
          <button
            key={qc}
            onClick={() => setQuestionCount(qc)}
            className={`px-3 py-1 border rounded ${
              questionCount === qc ? "bg-black text-white" : ""
            }`}
          >
            {qc}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm">로고 (선택)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogo(e.target.files?.[0] || null)}
        />
      </div>

      <div>
        <button
          disabled={!canSubmit}
          onClick={downloadPdf}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-40"
        >
          {loading ? "생성 중..." : "OMR PDF 다운로드"}
        </button>
      </div>
    </div>
  );
}
