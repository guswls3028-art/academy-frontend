import type { APIRequestContext, BrowserContext, Request } from "@playwright/test";
import { assertQaStudentParentRuntime, QA_API, QA_BASE, QA_TENANT } from "./qaStudentParentScenario";
import { developmentUpstream, installReleaseContextGuard, installReleaseRequestGuard, releaseBoundaryFromEnv,
  type ReleaseBoundary } from "./releaseApiBoundary";

function tokenActor(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { user_id?: unknown };
    const id = String(payload.user_id ?? "");
    return /^[1-9][0-9]*$/.test(id) ? id : null;
  } catch { return null; }
}

/** OMR cleanup pattern: observed own clients only, after UI writes have stopped. */
export async function withOwnedScoreLeaseCleanup(
  context: BrowserContext,
  request: APIRequestContext,
  scope: { sessionId: number; actorAccess: string },
  work: () => Promise<void>,
  afterClose?: () => Promise<void>,
): Promise<void> {
  const errors: unknown[] = [];
  const observationFailures = new Set<string>();
  const clients = new Set<string>();
  const pendingObservations = new Set<Promise<void>>();
  let guard: Awaited<ReturnType<typeof installReleaseContextGuard>> | undefined;
  let drained = false;
  let closed = false;
  let actor: string | null = null;
  let boundary: ReleaseBoundary | null = null;
  const observe = (outgoing: Request) => {
    const capture = (async () => {
      try {
        const url = new URL(outgoing.url());
        const match = /^\/api\/v1\/results\/admin\/sessions\/([1-9][0-9]*)\/score-draft\/(?:commit\/)?$/.exec(url.pathname);
        if (!match) return;
        const headers = await outgoing.allHeaders();
        const client = headers["x-score-editor-client"];
        if (!client) {
          if (["PUT", "POST"].includes(outgoing.method())) observationFailures.add("score-lease-observation missing-client");
          return;
        }
        const bearer = /^Bearer (.+)$/i.exec(headers.authorization ?? "");
        // Compare actor identity, not token bytes: UI login/refresh may mint another
        // access token for the same editor. This is a scope check, not JWT auth.
        // The immutable production bundle names the production API. Its browser
        // request is routed to the isolated API by the installed release guard;
        // validate that same effective origin instead of rejecting the raw URL.
        const upstream = boundary ? new URL(developmentUpstream(boundary, url.toString())) : null;
        if (!upstream || ![new URL(QA_BASE).origin, new URL(QA_API).origin].includes(upstream.origin)
          || match[1] !== String(scope.sessionId) || headers["x-tenant-code"] !== QA_TENANT
          || !bearer || !actor || tokenActor(bearer[1]) !== actor
          || client.length > 128 || /[\r\n]/.test(client)) {
          observationFailures.add("score-lease-observation scope-mismatch");
          return;
        }
        clients.add(client);
      } catch { observationFailures.add("score-lease-observation headers-failed"); }
    })();
    pendingObservations.add(capture);
    void capture.finally(() => pendingObservations.delete(capture));
  };

  try {
    assertQaStudentParentRuntime();
    boundary = releaseBoundaryFromEnv(process.env);
    actor = tokenActor(scope.actorAccess);
    if (!boundary || boundary.mode !== "development" || !actor
      || !Number.isSafeInteger(scope.sessionId) || scope.sessionId <= 0
      || request === context.request) {
      throw new Error("score-lease-setup invalid-owned-scope-or-request");
    }
    installReleaseRequestGuard(request, boundary);
    guard = await installReleaseContextGuard(context, boundary);
    context.on("request", observe);
    await work();
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      if (guard) {
        // Reject new UI/heartbeat requests and await already accepted routes.
        await guard.beginClose();
        drained = true;
        guard.assertClean();
      }
    } catch { errors.push(new Error("score-lease-context-drain failed")); }
    context.off("request", observe);
    await Promise.all([...pendingObservations]);
    try {
      await context.close();
      closed = true;
    } catch { errors.push(new Error("score-lease-context-close failed")); }
    for (const failure of observationFailures) errors.push(new Error(failure));

    // Use the independent fixture request after closing the browser context;
    // its context.request would already be disposed. Never substitute admin.
    if (drained && closed) {
      for (const client of clients) {
        try {
          const response = await request.post(`${QA_API}/api/v1/results/admin/sessions/${scope.sessionId}/score-draft/commit/`, {
            headers: { Authorization: `Bearer ${scope.actorAccess}`, "X-Tenant-Code": QA_TENANT, "X-Score-Editor-Client": client },
            data: { release_lease: true }, timeout: 60_000,
          });
          const status = response.status();
          await response.dispose();
          if (status !== 204 && status !== 404) errors.push(new Error(`score-lease-release status=${status}`));
        } catch { errors.push(new Error("score-lease-release transport-failed")); }
      }
    }
    if (afterClose) {
      try { await afterClose(); } catch (error) { errors.push(error); }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Owned score workflow and cleanup failed");
}
