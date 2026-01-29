// src/student/shared/components/EmptyState.tsx
/**
 * ✅ EmptyState
 * - 빈 상태 표준 컴포넌트
 */

export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        padding: "18px 14px",
        border: "1px dashed #ddd",
        borderRadius: 10,
        color: "#666",
        background: "#fafafa",
      }}
    >
      <div style={{ fontWeight: 800, color: "#444" }}>{title}</div>
      {description && (
        <div style={{ marginTop: 6, fontSize: 13 }}>{description}</div>
      )}
    </div>
  );
}
