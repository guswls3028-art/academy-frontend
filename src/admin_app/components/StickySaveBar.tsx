// PATH: src/admin_app/components/StickySaveBar.tsx
// 모바일 하단 고정 저장 바 — Dirty 시에만 표시

type Props = {
  visible: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
};

export default function StickySaveBar({ visible, onDiscard, onSave, saving }: Props) {
  if (!visible) return null;

  return (
    <div className="fixed left-0 right-0 bottom-0 z-30 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-area-pb">
      <div className="text-xs text-slate-500 mb-2">변경 사항이 있습니다</div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 ds-button min-h-[48px] rounded-xl"
          data-intent="secondary"
          data-size="md"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 ds-button min-h-[48px] rounded-xl"
          data-intent="primary"
          data-size="md"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
