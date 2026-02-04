export default function RequireSessionContext({
  sessionId,
  children,
}: {
  sessionId?: number;
  children: React.ReactNode;
}) {
  // ✅ UX 체험 모드: session 없어도 전부 노출
  return <>{children}</>;
}
