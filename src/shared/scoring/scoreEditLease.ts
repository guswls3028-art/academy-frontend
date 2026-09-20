import api from "@/shared/api/axios";

const SCORE_EDITOR_RECOVERY_KEY = "score-editor-recovery-id";

function createScoreEditorClientId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 권한용 client id는 문서 수명에만 존재한다. sessionStorage는 탭 복제 시 함께
// 복사될 수 있으므로 lease owner 식별자로 사용하지 않는다.
const scoreEditorClientId = createScoreEditorClientId();

// Shared by the score table and grading dialogs in this document. Count before
// any header/acquire await; exit must not overtake a pending score operation.
const pendingWrites = new Map<number, number>();
export function hasPendingScoreDraftWrite(sessionId: number): boolean {
  return (pendingWrites.get(sessionId) ?? 0) > 0;
}

export async function trackScoreDraftWrite<T>(sessionId: number, write: () => Promise<T>): Promise<T> {
  pendingWrites.set(sessionId, (pendingWrites.get(sessionId) ?? 0) + 1);
  try {
    return await write();
  } finally {
    const remaining = (pendingWrites.get(sessionId) ?? 1) - 1;
    if (remaining > 0) pendingWrites.set(sessionId, remaining);
    else pendingWrites.delete(sessionId);
  }
}

export async function scoreEditorRequestHeaders() {
  return { "X-Score-Editor-Client": scoreEditorClientId };
}

export function resolvedScoreEditorClientId(): string {
  return scoreEditorClientId;
}

/** 서버 저장 실패 복구용 식별자. 권한 판정에는 절대 사용하지 않는다. */
export function resolvedScoreEditorRecoveryId(): string {
  try {
    const existing = sessionStorage.getItem(SCORE_EDITOR_RECOVERY_KEY);
    if (existing) return existing;
    const created = createScoreEditorClientId();
    sessionStorage.setItem(SCORE_EDITOR_RECOVERY_KEY, created);
    return created;
  } catch {
    return scoreEditorClientId;
  }
}

export async function runWithScoreEditLease<T>(
  sessionId: number,
  mutate: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  return trackScoreDraftWrite(sessionId, async () => {
    const clientHeaders = await scoreEditorRequestHeaders();
    await api.put(
      `/results/admin/sessions/${sessionId}/score-draft/`,
      { changes: [] },
      { headers: clientHeaders },
    );
    const release = () => api.post(
      `/results/admin/sessions/${sessionId}/score-draft/commit/`,
      { release_lease: true },
      { headers: clientHeaders },
    );
    let result: T;
    try {
      result = await mutate({
        ...clientHeaders,
        "X-Score-Session-Id": String(sessionId),
      });
    } catch (error) {
      try {
        await release();
      } catch {
        // 원래 점수 저장 실패를 보존한다. lease는 2분 안에 만료된다.
      }
      throw error;
    }
    await release();
    return result;
  });
}
