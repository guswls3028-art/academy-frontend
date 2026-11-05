import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "guswls3028-art/academy-frontend";
const LIVE_VERSION = "https://hakwonplus.com/version.json";
const SHA = /^[a-f0-9]{40}$/;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
  } catch {
    // CLI stderr can contain auth context. Keep the failure actionable and secret-free.
    throw new Error("GitHub evidence read failed. Check configured gh authentication/network; do not request customer credentials.");
  }
}

export function parseArgs(args) {
  const options = { port: 0, prepareOnly: true };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (key === "--prepare-only") options.prepareOnly = true;
    else if (key === "--serve") options.prepareOnly = false;
    else if (key === "--help") options.help = true;
    else {
      assert.ok(["--run", "--evidence", "--output", "--port"].includes(key), `Unknown option: ${key}`);
      const value = args[++i];
      assert.ok(value && !value.startsWith("--"), `Missing value for ${key}`);
      options[key.slice(2)] = key === "--port" ? Number(value) : value;
    }
  }
  assert.ok(Number.isSafeInteger(options.port) && (options.port === 0 || options.port >= 1024) && options.port <= 65535, "Invalid loopback port");
  if (options.run) assert.match(options.run, /^[1-9][0-9]*$/);
  assert.ok(!(options.run && options.evidence), "Use --run or --evidence, not both");
  assert.ok(!(args.includes("--serve") && args.includes("--prepare-only")), "Choose --serve or --prepare-only");
  return options;
}

export function validateEvidence(evidence, expectedSha) {
  assert.match(evidence.frontendSha || "", SHA, "Evidence needs an exact frontend SHA");
  if (expectedSha) assert.equal(evidence.frontendSha, expectedSha, "Evidence differs from requested/live revision");
  assert.equal(evidence.passed, true, "Failed or unfinished QA evidence cannot be marked verified");
  assert.match(evidence.tenantCode || "", /^qa-ymath-realuse-fe-[a-z0-9-]+$/, "Only isolated synthetic release evidence is accepted");
  assert.equal(evidence.cleanup?.tenantCode, evidence.tenantCode, "Cleanup target differs");
  assert.equal(evidence.cleanup?.remaining?.tenants, 0, "Tenant cleanup is unproven");
  assert.equal(evidence.cleanup?.remaining?.users, 0, "User cleanup is unproven");
  for (const value of Object.values(evidence.cleanup.remaining)) assert.equal(value, 0, "QA residue remains");
}

export function selectRun(runs, liveSha) {
  assert.match(liveSha, SHA, "Live revision must be an exact SHA");
  const run = runs.find((candidate) => candidate.head_sha === liveSha && candidate.head_branch === "main"
    && candidate.status === "completed" && candidate.conclusion === "success");
  assert.ok(run, "No successful main run matches the live SHA. Inspect release tracking or use an explicit historical --run; never label latest main as live.");
  assert.match(String(run.id), /^[1-9][0-9]*$/);
  return String(run.id);
}

function filesUnder(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), "Evidence symlinks are not served");
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

export function prepareWorkbench(source, destination, provenance = {}) {
  source = fs.realpathSync(source);
  destination = path.resolve(destination);
  const relative = path.relative(source, destination);
  assert.ok(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), "Workbench output must be outside the evidence directory");
  assert.ok(!fs.existsSync(destination), "Use a new output directory; an existing review must not be overwritten");
  const files = filesUnder(source);
  const summaries = files.filter((file) => path.basename(file) === "development-release.json");
  assert.equal(summaries.length, 1, "Expected one development-release.json");
  const evidence = JSON.parse(fs.readFileSync(summaries[0], "utf8"));
  validateEvidence(evidence, provenance.expectedSha);
  const captures = files.filter((file) => file.toLowerCase().endsWith(".png")).sort();
  assert.ok(captures.length > 0 && captures.length <= 1000, "Expected 1–1000 captured QA screens");
  // Read and validate everything before creating a supposedly usable review.
  const images = captures.map((file, index) => {
    assert.ok(fs.statSync(file).size <= 20 * 1024 * 1024, "Screenshot exceeds review limit");
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length >= 33 && bytes.subarray(0, 8).equals(PNG) && bytes.toString("ascii", 12, 16) === "IHDR", "Invalid PNG evidence");
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    assert.ok(width > 0 && height > 0 && width <= 20000 && height <= 40000, "Invalid screenshot dimensions");
    return { bytes, entry: { id: index, file: `images/${String(index).padStart(4, "0")}.png`,
      label: path.relative(source, file).split(path.sep).join("/"), width, height,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex") } };
  });
  const manifest = { schema: "academy-visual-review/v1", mode: "captured-isolated-qa",
    frontendSha: evidence.frontendSha, backendGovernanceSha: evidence.backendGovernanceSha || null,
    runId: provenance.runId || null, liveMatchedAt: provenance.liveMatchedAt || null,
    createdAt: new Date().toISOString(), cleanup: { tenants: 0, users: 0 },
    images: images.map(({ entry }) => entry) };
  fs.mkdirSync(path.join(destination, "images"), { recursive: true });
  for (const { bytes, entry } of images) fs.writeFileSync(path.join(destination, entry.file), bytes);
  fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(destination, "index.html"), renderWorkbench(manifest));
  return manifest;
}

export function renderWorkbench(manifest) {
  const payload = JSON.stringify(manifest).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Academy 시각 검수 작업대</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#202938;font:15px/1.5 system-ui,sans-serif}header{padding:20px 28px;background:#fff;border-bottom:1px solid #dce0e6}h1{font-size:23px;margin:0 0 8px}p{margin:6px 0}.meta{color:#556273;font-size:13px;overflow-wrap:anywhere}.tools{display:flex;gap:10px;flex-wrap:wrap;padding-top:12px}input,select,button{font:inherit;border:1px solid #bbc4d1;border-radius:6px;background:white;padding:9px 12px;min-height:44px}input{flex:1;min-width:220px}button{cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #3871dd;outline-offset:2px}main{padding:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}.card{background:white;border:1px solid #dce0e6;border-radius:8px;overflow:hidden}.card img{width:100%;height:240px;object-fit:contain;object-position:top;background:#edf0f4;display:block}.card button{width:100%;text-align:left;border:0;padding:12px}.label{overflow-wrap:anywhere;font-size:13px}.size{color:#657187;font-size:12px;margin-top:7px}dialog{width:calc(100vw - 32px);max-width:none;height:calc(100vh - 32px);border:1px solid #aeb8c6;padding:0;border-radius:8px}dialog::backdrop{background:#17202dba}.dialogbar{display:flex;gap:12px;align-items:center;position:sticky;top:0;background:white;padding:12px;border-bottom:1px solid #dce0e6;z-index:1}.dialogbar span{flex:1;overflow-wrap:anywhere;font-size:13px}.viewport{overflow:auto;height:calc(100% - 70px);padding:16px;background:#e7eaf0}.viewport img{display:block;max-width:100%;height:auto;margin:auto}.viewport.native img{max-width:none}#empty{padding:24px}.notice{color:#73541a}a{color:#2358a1}@media(max-width:500px){header{padding:16px}main{padding:12px}.dialogbar{flex-wrap:wrap}}
</style><header><h1>Academy 시각 검수 작업대</h1>
<p>격리 개발 QA에서 저장한 실제 렌더를 원본 크기로 비교합니다.</p>
<p class="meta">프런트 ${escapeHtml(manifest.frontendSha)} · ${manifest.images.length}개 화면 · QA 종료 시 tenant/user 잔여 0</p>
<p class="meta">${manifest.liveMatchedAt ? `운영 버전 대조: ${escapeHtml(manifest.liveMatchedAt)}` : "명시적으로 선택한 과거/로컬 증거입니다. 현재 운영과 일치한다고 판정하지 않습니다."}</p>
<p class="notice">캡처 검수용입니다. 현재 후보의 클릭·저장·새로고침 성공은 해당 후보의 격리 실사용 검증에서 확인해야 합니다.</p>
<div class="tools"><input id="search" aria-label="화면 이름 검색" placeholder="성적: exam · 수강: enrollment · 게시판: board"><select id="width" aria-label="화면 폭"><option value="all">모든 화면 폭</option><option value="mobile">모바일 · 500px 이하</option><option value="desktop">데스크톱 · 1000px 이상</option></select><span id="count" aria-live="polite"></span></div></header>
<main id="grid"></main><p id="empty" hidden>검색에 맞는 캡처가 없습니다. 미촬영 화면은 해당 담당자의 정확한 후보 QA에 추가하세요.</p>
<dialog id="detail"><div class="dialogbar"><span id="caption"></span><button id="size">원본 크기</button><button id="close">닫기</button></div><div class="viewport" id="viewport"><img id="full" alt="선택한 QA 화면"></div></dialog>
<script type="application/json" id="data">${payload}</script><script>
const data=JSON.parse(document.getElementById('data').textContent);const grid=document.getElementById('grid');const dialog=document.getElementById('detail');const viewport=document.getElementById('viewport');
function render(){const query=document.getElementById('search').value.toLowerCase();const width=document.getElementById('width').value;const matches=data.images.filter(x=>x.label.toLowerCase().includes(query)&&(width==='all'||(width==='mobile'?x.width<=500:x.width>=1000)));grid.replaceChildren();document.getElementById('count').textContent=matches.length+'개';document.getElementById('empty').hidden=matches.length>0;for(const x of matches){const card=document.createElement('article');card.className='card';const button=document.createElement('button');button.type='button';const image=document.createElement('img');image.src=x.file;image.alt=x.label;image.loading='lazy';const label=document.createElement('div');label.className='label';label.textContent=x.label;const size=document.createElement('div');size.className='size';size.textContent=x.width+' × '+x.height;button.append(image,label,size);button.onclick=()=>{document.getElementById('full').src=x.file;document.getElementById('caption').textContent=x.label+' · '+size.textContent;viewport.classList.remove('native');document.getElementById('size').textContent='원본 크기';dialog.showModal();};card.append(button);grid.append(card);}}
document.getElementById('search').oninput=render;document.getElementById('width').onchange=render;document.getElementById('close').onclick=()=>dialog.close();document.getElementById('size').onclick=()=>{const native=viewport.classList.toggle('native');document.getElementById('size').textContent=native?'화면에 맞춤':'원본 크기';};render();
</script></html>`;
}

export async function serveWorkbench(directory, port = 0) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.schema, "academy-visual-review/v1");
  assert.ok(Array.isArray(manifest.images) && manifest.images.length > 0 && manifest.images.length <= 1000);
  const servedFiles = ["index.html", "manifest.json"];
  for (const entry of manifest.images) {
    assert.match(entry.file, /^images\/[0-9]{4}\.png$/, "Invalid review image path");
    servedFiles.push(entry.file);
  }
  for (const file of servedFiles) {
    const resolved = fs.realpathSync(path.join(directory, file));
    assert.equal(resolved, path.join(directory, file), "Review file must not use a symlink");
  }
  const allowed = new Map([["/", ["index.html", "text/html; charset=utf-8"]], ["/index.html", ["index.html", "text/html; charset=utf-8"]],
    ["/manifest.json", ["manifest.json", "application/json"]], ...manifest.images.map((entry) => [`/${entry.file}`, [entry.file, "image/png"]])]);
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== new URL(origin).host) { response.writeHead(421).end(); return; }
    const requested = new URL(request.url, origin);
    const entry = requested.origin === origin && allowed.get(requested.pathname);
    if (!entry) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": entry[1], "cache-control": "no-store", "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(path.join(directory, entry[0])).on("error", () => response.destroy()).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return server;
}

export async function run(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log("node scripts/visual-review-workbench.mjs [--run ID | --evidence DIR] [--output NEW_DIR] [--serve --port 0]\nDefault: discover current public version, match successful main QA, and prepare local synthetic QA images, manifest and HTML. Use a local image reader directly or --serve for a loopback-only viewer. No customer URL/account is needed. Captures are not a live test session.");
    return;
  }
  const output = path.resolve(options.output || path.join(process.cwd(), "..", "_artifacts", "visual-review", String(Date.now())));
  let source = options.evidence;
  const provenance = {};
  if (!source) {
    if (!options.run) {
      const response = await fetch(`${LIVE_VERSION}?visual_review=${Date.now()}`, { signal: AbortSignal.timeout(20_000), redirect: "error" });
      assert.equal(response.status, 200, "Cannot read live frontend version");
      provenance.expectedSha = (await response.json()).version;
      assert.match(provenance.expectedSha || "", SHA);
      const runs = JSON.parse(gh(["api", `repos/${REPOSITORY}/actions/workflows/quality-gate.yml/runs?head_sha=${provenance.expectedSha}&status=success&per_page=100`]));
      options.run = selectRun(runs.workflow_runs, provenance.expectedSha);
      provenance.liveMatchedAt = new Date().toISOString();
    }
    const run = JSON.parse(gh(["run", "view", options.run, "--repo", REPOSITORY, "--json", "headSha,headBranch,status,conclusion,jobs"]));
    assert.equal(run.headBranch, "main");
    assert.equal(run.status, "completed");
    assert.equal(run.conclusion, "success");
    assert.ok(run.jobs.some((job) => job.name === "Same-artifact isolated development real-use" && job.conclusion === "success"), "Required isolated development QA did not pass");
    if (provenance.expectedSha) assert.equal(run.headSha, provenance.expectedSha);
    provenance.expectedSha = run.headSha;
    provenance.runId = options.run;
    source = `${output}-source`;
    assert.ok(!fs.existsSync(source), "Evidence output exists; choose a new --output");
    gh(["run", "download", options.run, "--repo", REPOSITORY, "--name", "development-release-evidence", "--dir", source]);
    if (provenance.liveMatchedAt) {
      const response = await fetch(`${LIVE_VERSION}?visual_review_final=${Date.now()}`, { signal: AbortSignal.timeout(20_000), redirect: "error" });
      assert.equal(response.status, 200, "Cannot recheck live frontend version");
      assert.equal((await response.json()).version, provenance.expectedSha, "Live revision changed during evidence preparation; rerun discovery");
      provenance.liveMatchedAt = new Date().toISOString();
    }
  }
  const manifest = prepareWorkbench(source, output, provenance);
  console.log(JSON.stringify({ directory: output, frontendSha: manifest.frontendSha, screenshots: manifest.images.length, mode: manifest.mode }));
  if (!options.prepareOnly) {
    const server = await serveWorkbench(output, options.port);
    console.log(`Visual review: http://127.0.0.1:${server.address().port}`);
    const close = () => server.close(() => process.exit(0));
    process.once("SIGINT", close); process.once("SIGTERM", close);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
