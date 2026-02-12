// PATH: src/shared/ui/state/ModalState.tsx
export default function ModalState({
  message = "처리 중입니다…",
}: {
  message?: string;
}) {
  return (
    <div
      style={{
        padding: "32px 24px",
        textAlign: "center",
        fontSize: 13,
        fontWeight: "var(--font-meta)",
        color: "var(--color-text-muted)",
      }}
    >
      {message}
    </div>
  );
}
