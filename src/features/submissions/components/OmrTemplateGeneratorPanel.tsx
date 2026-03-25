// ====================================================================================================
// FILE: src/features/submissions/components/OmrTemplateGeneratorPanel.tsx
// ====================================================================================================
/**
 * OMR 답안지 생성 (프린트/그림판용)
 * - 서버 단일진실(sheet/questions) 기준
 * - PDF/PNG 다운로드
 */
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import api from "@/shared/api/axios";
import { downloadBlob } from "@/shared/utils/safeDownload";

export default function OmrTemplateGeneratorPanel({ examId }: { examId: number }) {
  const gen = useMutation({
    mutationFn: async (fmt: "pdf" | "png") => {
      const res = await api.post(
        `/exams/${examId}/omr-template/`,
        { format: fmt },
        { responseType: "blob" }
      );
      const mimeType = fmt === "pdf" ? "application/pdf" : "image/png";
      const blob = new Blob([res.data], { type: mimeType });
      downloadBlob(blob, `exam_${examId}_omr.${fmt}`);
    },
  });

  return (
    <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border-divider)', background: 'var(--color-bg-surface)' }}>
      <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>OMR 답안지 생성</div>
      <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        프린트 후 그림판 마킹 → 업로드 테스트 가능
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          intent="primary"
          size="sm"
          onClick={() => gen.mutate("pdf")}
          disabled={gen.isPending}
          loading={gen.isPending}
        >
          PDF 다운로드
        </Button>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={() => gen.mutate("png")}
          disabled={gen.isPending}
        >
          PNG 다운로드
        </Button>
      </div>
    </div>
  );
}
