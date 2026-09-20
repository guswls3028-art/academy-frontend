import http from "node:http";
import assert from "node:assert/strict";

/** Route-mock API state with a real same-origin receiver for Chromium keepalive.
 * Only local Vite assets are forwarded; no fallback API/production transport. */
export async function createScoreExitReceiver(viteOrigin: string, onRelease: (body: Record<string, unknown>) => void) {
  const vite = new URL(viteOrigin);
  assert.ok(vite.protocol === "http:" && ["localhost", "127.0.0.1"].includes(vite.hostname));
  const failures: string[] = [];
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url?.startsWith("/api/")) {
        assert.equal(request.method, "POST");
        assert.equal(request.url, "/api/v1/results/admin/sessions/9002/score-draft/commit/");
        assert.equal(request.headers["x-tenant-code"], "hakwonplus");
        assert.match(request.headers.authorization ?? "", /^Bearer\s+\S+$/);
        assert.match(request.headers["x-score-editor-client"] as string ?? "", /^[a-zA-Z0-9._-]{1,128}$/);
        let body = "";
        for await (const chunk of request) { body += chunk; assert.ok(body.length < 1024); }
        const parsed = JSON.parse(body);
        assert.deepEqual(parsed, { release_lease: true, release_if_empty: true });
        onRelease(parsed);
        response.writeHead(204); response.end();
        return;
      }
      assert.ok(request.method === "GET" || request.method === "HEAD");
      const target = new URL(request.url ?? "/", vite);
      assert.equal(target.origin, vite.origin);
      const upstream = http.request(target, {
        method: request.method, headers: { ...request.headers, host: vite.host },
      }, (incoming) => { response.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(response); });
      upstream.on("error", () => { failures.push("asset-transport"); response.destroy(); });
      upstream.end();
    } catch { failures.push("request-boundary"); response.writeHead(502); response.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    assertClean: () => assert.deepEqual(failures, []),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
