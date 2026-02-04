// ====================================================================================================
// FILE: src/features/materials/sheets/components/OmrTemplateModal.tsx
// NOTE: 외부 의존(서브미션 모듈) 재사용. 이 파일은 이 폴더 SSOT 범위 내에서만 보존.
// ====================================================================================================
import OmrTemplateGeneratorPanel from "@/features/submissions/components/OmrTemplateGeneratorPanel";

export default function OmrTemplateModal({
  open,
  onClose,
  examId,
}: {
  open: boolean;
  onClose: () => void;
  examId: number;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl border bg-[var(--bg-surface)] shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">OMR 답안지 생성</div>
          <button className="text-xs text-[var(--text-muted)]" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="p-4">
          {/* ✅ 기존에 이미 검증된 구현 재사용 */}
          <OmrTemplateGeneratorPanel examId={examId} />
        </div>
      </div>
    </div>
  );
}
