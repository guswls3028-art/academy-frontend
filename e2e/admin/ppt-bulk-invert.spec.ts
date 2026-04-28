/**
 * PPT 생성기 — 이미지 일괄 흑백반전 (운영 검증)
 *
 * 검증 시나리오:
 *   "흑백 반전을 하나씩 토글하지 않고, 여러 이미지를 한 번에 업로드 +
 *    글로벌 흑백반전 옵션 ON 으로 PPT 생성하면, 다운로드된 PPTX의
 *    모든 슬라이드 이미지가 픽셀 단위로 반전되어 있어야 한다."
 *
 * 결정성 확보:
 *   - UI 다운로드 트리거(R2 cross-origin presigned URL) 대신 API 직접 호출.
 *   - submit → poll → R2 fetch → unzip → PIL 픽셀 평균 검증.
 *
 * Tenant 1 (hakwonplus), [E2E-{ts}] 태그.
 */
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl } from "../helpers/auth";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as https from "https";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const API = getApiBaseUrl();
const TENANT = process.env.E2E_TENANT_CODE || "hakwonplus";
const USER = process.env.E2E_ADMIN_USER || "admin97";
const PASS = process.env.E2E_ADMIN_PASS || "test1234";
const FX_DIR = path.resolve(__dirname_local, "..", "fixtures");
const RUN_TAG = `[E2E-${Date.now()}]`;

function fetchBuffer(url: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
        reject(new Error(`R2 status ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("R2 fetch timeout")));
  });
}

test.describe("PPT 생성기 — 이미지 일괄 흑백반전 (운영 결과 검증)", () => {
  test("이미지 5장 + 흑백반전 토글 → 5장 모두 반전된 PPTX 생성", async ({ request, page }) => {
    test.setTimeout(360_000); // 6분

    // 1. 토큰 발급
    const tokRes = await request.post(`${API}/api/v1/token/`, {
      data: { username: USER, password: PASS, tenant_code: TENANT },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
      timeout: 30_000,
    });
    expect(tokRes.status()).toBe(200);
    const { access } = (await tokRes.json()) as { access: string };
    expect(access).toBeTruthy();
    console.log(`${RUN_TAG} 토큰 OK`);

    // 2. 5장 이미지 업로드 + invert=true
    const fixtures = [1, 2, 3, 4, 5].map((i) => path.join(FX_DIR, `test-bulk-invert-${i}.png`));
    for (const fp of fixtures) expect(fs.existsSync(fp)).toBeTruthy();

    const settings = {
      aspect_ratio: "16:9",
      background: "black",
      fit_mode: "contain",
      invert: true,
      grayscale: false,
      auto_enhance: false,
      brightness: 1.0,
      contrast: 1.0,
      per_slide: fixtures.map(() => ({ invert: true })),
    };

    // Playwright의 multipart 옵션은 같은 키(images) 중복을 지원하지 않음 →
    // Node 18+ 빌트인 fetch/FormData/Blob 으로 직접 멀티파트 전송
    const fd = new FormData();
    for (const fp of fixtures) {
      const blob = new Blob([fs.readFileSync(fp)], { type: "image/png" });
      fd.append("images", blob, path.basename(fp));
    }
    fd.append("order", JSON.stringify([0, 1, 2, 3, 4]));
    fd.append("settings", JSON.stringify(settings));

    const submitRes = await fetch(`${API}/api/v1/tools/ppt/generate/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT },
      body: fd,
    });
    expect(submitRes.status).toBeGreaterThanOrEqual(200);
    expect(submitRes.status).toBeLessThan(300);
    const submitBody = (await submitRes.json()) as { job_id: string; slide_count?: number };
    const jobId = submitBody.job_id;
    expect(jobId).toBeTruthy();
    expect(submitBody.slide_count).toBe(5);
    console.log(`${RUN_TAG} job_id=${jobId} dispatched_slide_count=${submitBody.slide_count}`);

    // 3. 폴링
    const start = Date.now();
    let download_url = "";
    let slide_count = 0;
    let lastStatus = "";
    for (let i = 0; i < 120; i++) {
      const pr = await request.get(`${API}/api/v1/jobs/${encodeURIComponent(jobId)}/progress/`, {
        headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": TENANT },
        timeout: 15_000,
      });
      const j = (await pr.json()) as {
        status: string;
        result?: { download_url: string; slide_count: number };
        error_message?: string | null;
      };
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (j.status !== lastStatus) {
        console.log(`${RUN_TAG} poll[${i}] t=${elapsed}s status=${j.status}`);
        lastStatus = j.status;
      }
      if (j.status === "DONE" && j.result?.download_url) {
        download_url = j.result.download_url;
        slide_count = j.result.slide_count;
        console.log(`${RUN_TAG} 워커 처리 완료: slides=${slide_count} t=${elapsed}s`);
        break;
      }
      if (j.status === "FAILED") {
        throw new Error(`Job FAILED: ${j.error_message}`);
      }
      await page.waitForTimeout(2000);
    }
    expect(download_url).toBeTruthy();
    expect(slide_count).toBe(5);

    // 4. R2 다운로드
    const buf = await fetchBuffer(download_url, 60_000);
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);

    // 5. unzip → 픽셀 검증
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ppt-bulk-invert-"));
    const pptxPath = path.join(tmpDir, "out.pptx");
    fs.writeFileSync(pptxPath, buf);
    const extractDir = path.join(tmpDir, "extract");
    fs.mkdirSync(extractDir);
    execSync(`unzip -q "${pptxPath}" -d "${extractDir}"`);

    const mediaDir = path.join(extractDir, "ppt", "media");
    expect(fs.existsSync(mediaDir)).toBeTruthy();
    const mediaFiles = fs.readdirSync(mediaDir).filter((f) =>
      /\.(png|jpe?g)$/i.test(f),
    );
    console.log(`${RUN_TAG} 임베딩 이미지 ${mediaFiles.length}개: ${mediaFiles.join(", ")}`);
    expect(mediaFiles.length).toBe(5);

    // PIL로 평균 픽셀 측정
    const pyOut = execSync(
      `MEDIA_DIR="${mediaDir}" python3 -c "
import os, glob
from PIL import Image
results = []
for p in sorted(glob.glob(os.environ['MEDIA_DIR'] + '/*')):
    if not p.lower().endswith(('.png','.jpg','.jpeg')): continue
    img = Image.open(p).convert('L')
    avg = sum(img.getdata()) / (img.size[0] * img.size[1])
    results.append((os.path.basename(p), avg))
for name, avg in results:
    print(f'IMG {name} {avg:.2f}')
overall = sum(a for _, a in results) / len(results)
mx = max(a for _, a in results)
mn = min(a for _, a in results)
print(f'STATS overall={overall:.2f} min={mn:.2f} max={mx:.2f} n={len(results)}')
"`,
      { encoding: "utf-8" },
    );
    console.log(`${RUN_TAG} 픽셀 분석:\n${pyOut}`);

    const statsM = pyOut.match(/STATS overall=([\d.]+) min=([\d.]+) max=([\d.]+) n=(\d+)/);
    expect(statsM).not.toBeNull();
    const [, overallS, minS, maxS, nS] = statsM!;
    const overall = parseFloat(overallS);
    const mx = parseFloat(maxS);
    const mn = parseFloat(minS);
    const n = parseInt(nS, 10);

    expect(n).toBe(5);
    // 원본 이미지 평균 ~138 (흰배경+검정요소). 반전 후 ~117 (= 255 - 138).
    // max < 128 이면 5장 모두 어두운 평균 = 모두 반전 적용됨
    expect(mx).toBeLessThan(128);
    // 5장 평균이 거의 동일해야 함 (분산 작음 → 일관 처리)
    expect(mx - mn).toBeLessThan(5);

    console.log(`${RUN_TAG} ✓ 5장 모두 일괄 흑백반전 검증 PASS (overall=${overall.toFixed(1)}, range=${mn.toFixed(1)}~${mx.toFixed(1)})`);

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
});
