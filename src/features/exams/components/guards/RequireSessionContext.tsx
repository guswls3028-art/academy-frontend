// PATH: src/features/exams/components/guards/RequireSessionContext.tsx
export default function RequireSessionContext({
  sessionId,
  children,
}: {
  sessionId?: number;
  children: React.ReactNode;
}) {
  if (!sessionId) {
    return (
      <div className="rounded border bg-[var(--bg-surface-soft)] p-4 text-sm text-muted">
        ⚠️ 세션 컨텍스트(session_id)가 필요합니다.  
        <br />
        세션 화면에서 시험으로 진입하거나, URL에 session_id를 포함하세요.
      </div>
    );
  }
  return <>{children}</>;
}
