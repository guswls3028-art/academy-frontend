// PATH: src/app_admin/domains/scores/api/scoreDraft.ts
/**
 * Score edit recovery API.
 * 실제 성적 PATCH 전에 복구용 변경 목록을 저장하고, PATCH 완료 뒤 commit으로 비운다.
 */

import api from "@/shared/api/axios";

const SCORE_EDITOR_CLIENT_KEY = "score-editor-client-id";
let scoreEditorClientId: string | null = null;
let scoreEditorClientPromise: Promise<string> | null = null;
const scoreEditorChannels: BroadcastChannel[] = [];

function createScoreEditorClientId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getScoreEditorClientId(): Promise<string> {
  if (scoreEditorClientId) return scoreEditorClientId;
  if (scoreEditorClientPromise) return scoreEditorClientPromise;
  scoreEditorClientPromise = (async () => {
    let candidate = "";
    try {
      candidate = sessionStorage.getItem(SCORE_EDITOR_CLIENT_KEY) ?? "";
    } catch {
      // sessionStorage가 차단된 브라우저는 현재 페이지 수명 동안만 식별자를 유지한다.
    }
    if (!candidate) candidate = createScoreEditorClientId();

    // 브라우저의 "탭 복제"는 sessionStorage까지 복제할 수 있다. BroadcastChannel로
    // 같은 client id를 이미 쓰는 살아있는 탭을 확인하고 충돌 시 새 id를 발급한다.
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("score-editor-client-presence");
      scoreEditorChannels.push(channel);
      const nonce = createScoreEditorClientId();
      let occupied = false;
      let activeId = candidate;
      channel.onmessage = (event: MessageEvent<{ type?: string; clientId?: string; nonce?: string }>) => {
        const message = event.data;
        if (message?.type === "probe" && message.clientId === activeId) {
          channel.postMessage({ type: "occupied", clientId: activeId, nonce: message.nonce });
        } else if (
          message?.type === "occupied" &&
          message.clientId === candidate &&
          message.nonce === nonce
        ) {
          occupied = true;
        }
      };
      channel.postMessage({ type: "probe", clientId: candidate, nonce });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
      if (occupied) candidate = createScoreEditorClientId();
      activeId = candidate;
    }

    scoreEditorClientId = candidate;
    try { sessionStorage.setItem(SCORE_EDITOR_CLIENT_KEY, candidate); } catch { /* ignore */ }
    return candidate;
  })();
  return scoreEditorClientPromise;
}

export async function scoreEditorRequestHeaders() {
  return { "X-Score-Editor-Client": await getScoreEditorClientId() };
}

export function resolvedScoreEditorClientId(): string | null {
  return scoreEditorClientId;
}

export type PendingChange =
  | { type: "examTotal"; examId: number; enrollmentId: number; score: number; maxScore?: number; metaStatus?: "NOT_SUBMITTED" }
  | { type: "examObjective"; examId: number; enrollmentId: number; score: number }
  | { type: "examSubjective"; examId: number; enrollmentId: number; score: number }
  | {
      type: "homework";
      enrollmentId: number;
      homeworkId: number;
      score: number | null;
      metaStatus?: "NOT_SUBMITTED";
    };

export async function getScoreDraft(sessionId: number): Promise<{ changes: PendingChange[] }> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/score-draft/`, {
    headers: await scoreEditorRequestHeaders(),
  });
  return res.data as { changes: PendingChange[] };
}

export async function putScoreDraft(
  sessionId: number,
  changes: PendingChange[]
): Promise<{ changes: PendingChange[] }> {
  const res = await api.put(`/results/admin/sessions/${sessionId}/score-draft/`, {
    changes,
  }, {
    headers: await scoreEditorRequestHeaders(),
  });
  return res.data as { changes: PendingChange[] };
}

export async function postScoreDraftCommit(
  sessionId: number,
  releaseLease = false,
): Promise<void> {
  await api.post(
    `/results/admin/sessions/${sessionId}/score-draft/commit/`,
    { release_lease: releaseLease },
    { headers: await scoreEditorRequestHeaders() },
  );
}

export function isScoreEditLockedError(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { code?: string } };
  } | null)?.response;
  return response?.status === 409 && response.data?.code === "SCORE_EDIT_LOCKED";
}
