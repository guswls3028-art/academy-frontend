import assert from "node:assert/strict";
import http from "node:http";

export const PLAYBACK_END_PROXY_PATH = "/__qa__/playback-end";
export const SCORE_EXIT_PROXY_PATH = "/__qa__/score-exit/";

/** Same-origin terminal transport only; never a general API proxy. */
export function createPlaybackEndProxy({ apiOrigin, webOrigin, tenantCodes, onFailure }) {
  const api = new URL(apiOrigin);
  const web = new URL(webOrigin);
  assert.ok(api.origin === apiOrigin && api.protocol === "http:" && api.hostname === "127.0.0.1" && api.port);
  assert.ok(web.origin === webOrigin && web.protocol === "http:" && ["localhost", "127.0.0.1"].includes(web.hostname));
  assert.ok(Array.isArray(tenantCodes) && tenantCodes.length > 0
    && tenantCodes.every((code) => /^qa-ymath-realuse-[a-z0-9-]+$/.test(code)));
  const tenants = new Set(tenantCodes);
  const pending = new Set();
  let closing = false;
  const reject = (response, code) => {
    onFailure(code);
    if (!response.destroyed && !response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain" }); response.end("QA playback transport refused");
    } else response.destroy();
  };
  const forward = async (request, response) => {
    let stage = "request";
    const deadline = setTimeout(() => request.destroy(), 10_000);
    try {
      const scoreMatch = /^\/__qa__\/score-exit\/([1-9][0-9]*)$/.exec(request.url ?? "");
      assert.ok(!closing && request.method === "POST" && (request.url === PLAYBACK_END_PROXY_PATH || scoreMatch));
      assert.equal(request.headers.origin, webOrigin);
      assert.equal(request.headers.host, web.host);
      assert.ok(tenants.has(request.headers["x-tenant-code"]));
      if (scoreMatch) assert.ok(Number.isSafeInteger(Number(scoreMatch[1])));
      assert.match(request.headers.authorization ?? "", /^Bearer\s+\S+$/);
      assert.match(request.headers["content-type"] ?? "", /^application\/json(?:;\s*charset=utf-8)?$/i);
      for (const name of ["authorization", "x-tenant-code", "origin", "content-type"]) {
        assert.equal(request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length, 1);
      }
      const scopedHeaders = {};
      if (scoreMatch) {
        assert.equal(request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === "x-score-editor-client").length, 1);
        assert.match(request.headers["x-score-editor-client"] ?? "", /^[a-zA-Z0-9._-]{1,128}$/);
        scopedHeaders["x-score-editor-client"] = request.headers["x-score-editor-client"];
      }
      for (const name of ["x-student-id", "x-client", "x-client-version"]) {
        if (request.headers[name] === undefined) continue;
        assert.equal(request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length, 1);
        const value = request.headers[name];
        assert.match(value, name === "x-student-id" ? /^[1-9][0-9]{0,15}$/ : /^[a-zA-Z0-9._-]{1,100}$/);
        if (name === "x-student-id") assert.ok(Number.isSafeInteger(Number(value)));
        scopedHeaders[name] = value;
      }
      assert.ok(!request.headers.cookie);
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        assert.ok(size <= 8192);
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const data = JSON.parse(body.toString("utf8"));
      if (scoreMatch) {
        assert.ok(data && Object.keys(data).sort().join(",") === "release_if_empty,release_lease"
          && data.release_if_empty === true && data.release_lease === true);
      } else assert.ok(data && Object.keys(data).join(",") === "token" && typeof data.token === "string" && data.token.length > 0);
      stage = "upstream";
      await new Promise((resolve, rejectUpstream) => {
        const upstreamPath = scoreMatch
          ? `/api/v1/results/admin/sessions/${scoreMatch[1]}/score-draft/commit/`
          : "/api/v1/media/playback/end/";
        const upstream = http.request(new URL(upstreamPath, api), {
          method: "POST", signal: AbortSignal.timeout(10_000), headers: {
            ...scopedHeaders,
            authorization: request.headers.authorization, "x-tenant-code": request.headers["x-tenant-code"],
            "content-type": request.headers["content-type"], "content-length": body.length,
            origin: webOrigin, connection: "close", "accept-encoding": "identity",
          },
        }, (incoming) => {
          const responseChunks = [];
          let responseSize = 0;
          incoming.on("data", (chunk) => {
            responseSize += chunk.length;
            if (responseSize > 64 * 1024) incoming.destroy(new Error("response-size"));
            else responseChunks.push(chunk);
          });
          incoming.on("error", rejectUpstream);
          incoming.on("end", () => {
            try {
              assert.ok(incoming.statusCode >= 200 && incoming.statusCode < 300);
              assert.equal(incoming.headers["access-control-allow-origin"], webOrigin);
              assert.equal(incoming.headers["access-control-allow-credentials"], "true");
              const bytes = Buffer.concat(responseChunks);
              const headers = { "content-type": incoming.headers["content-type"] ?? "application/json", "content-length": bytes.length, "cache-control": "no-store" };
              if (incoming.headers["content-encoding"]) headers["content-encoding"] = incoming.headers["content-encoding"];
              response.writeHead(incoming.statusCode, headers);
              response.end(bytes);
              resolve();
            } catch { rejectUpstream(new Error("response-policy")); }
          });
        });
        upstream.on("error", rejectUpstream);
        upstream.end(body);
      });
    } catch { reject(response, stage); }
    finally { clearTimeout(deadline); }
  };
  return {
    handle(request, response) {
      const operation = forward(request, response);
      pending.add(operation);
      void operation.finally(() => pending.delete(operation));
    },
    async close() { closing = true; await Promise.allSettled([...pending]); },
  };
}
