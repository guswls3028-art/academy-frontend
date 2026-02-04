// ====================================================================================================
// FILE: src/features/submissions/components/OmrTemplateGeneratorPanel.tsx
// ====================================================================================================
/**
 * OMR 답안지 생성 (프린트/그림판용)
 * - 서버 단일진실(sheet/questions) 기준
 * - PDF/PNG 다운로드
 */
import { useMutation } from "@tanstack/react-query";
import api from "@/shared/api/axios";

export default function OmrTemplateGeneratorPanel({ examId }: { examId: number }) {
  const gen = useMutation({
    mutationFn: async (fmt: "pdf" | "png") => {
      const res = await api.post(
        `/exams/${examId}/omr-template/`,
        { format: fmt },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam_${examId}_omr.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-2 text-sm font-semibold text-neutral-100">OMR 답안지 생성</div>
      <div className="text-xs text-neutral-400 mb-3">
        프린트 후 그림판 마킹 → 업로드 테스트 가능
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-950 disabled:opacity-40"
          onClick={() => gen.mutate("pdf")}
          disabled={gen.isPending}
        >
          PDF 다운로드
        </button>
        <button
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
          onClick={() => gen.mutate("png")}
          disabled={gen.isPending}
        >
          PNG 다운로드
        </button>
      </div>
    </div>
  );
}
