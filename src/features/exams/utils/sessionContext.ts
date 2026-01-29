// PATH: src/features/exams/utils/sessionContext.ts

/**
 * Session Context Resolver
 *
 * 우선순위:
 * 1) query ?session_id=
 * 2) pathname /sessions/:id
 */
export function resolveSessionIdFromLocation(
  search: string,
  pathname: string
): number {
  // 1) query ?session_id=
  const sp = new URLSearchParams(search);
  const q = Number(sp.get("session_id"));
  if (Number.isFinite(q) && q > 0) return q;

  // 2) pathname /sessions/:id
  const m = pathname.match(/\/sessions\/(\d+)/);
  const p = m ? Number(m[1]) : 0;
  if (Number.isFinite(p) && p > 0) return p;

  return 0;
}
