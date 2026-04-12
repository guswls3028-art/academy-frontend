// ======================================================================================
// FILE: src/features/materials/sheets/components/editor/SheetsEditorModal.tsx
// ======================================================================================
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/ds";
import SheetsEditorBody from "./SheetsEditorBody";

export function SheetsEditorModal({
  open,
  sheetId,
  onClose,
}: {
  open: boolean;
  sheetId: number;
  onClose: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-4 lg:inset-8 bg-[var(--bg-page)] rounded-2xl overflow-hidden flex flex-col border shadow-2xl">
        <div className="px-4 py-3 border-b bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="text-sm font-extrabold">시험지 상품 제작실</div>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <SheetsEditorBody sheetId={sheetId} />
        </div>
      </div>
    </div>,
    document.body
  );
}
