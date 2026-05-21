// PATH: src/shared/ui/state/ModalState.tsx
export default function ModalState({
  message = "처리 중입니다…",
}: {
  message?: string;
}) {
  return (
    <div className="ds-modal-state">
      {message}
    </div>
  );
}
