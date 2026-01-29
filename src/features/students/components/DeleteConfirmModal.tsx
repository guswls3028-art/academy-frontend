// PATH: src/features/students/components/DeleteConfirmModal.tsx

import { deleteStudent } from "../api/students";

export default function DeleteConfirmModal({
  id,
  onClose,
  onSuccess,
}: {
  id: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  async function handleDelete() {
    await deleteStudent(id);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[320px] rounded-lg bg-[var(--bg-surface)] shadow-xl border border-[var(--border-divider)] overflow-hidden">
        <div className="border-b border-[var(--border-divider)] px-4 py-3 bg-[var(--bg-surface-soft)]">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            학생 삭제
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            되돌릴 수 없습니다
          </div>
        </div>

        <div className="px-4 py-4 text-sm text-[var(--text-secondary)]">
          해당 학생을 정말 삭제하시겠습니까?
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md
              border border-[var(--border-divider)]
              bg-[var(--bg-surface)]
              text-[var(--text-secondary)]
              hover:bg-[var(--bg-surface-soft)]"
          >
            취소
          </button>

          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm rounded-md
              bg-[var(--color-danger)]
              text-white
              hover:opacity-90"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
