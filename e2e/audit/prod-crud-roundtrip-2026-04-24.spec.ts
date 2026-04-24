/**
 * 운영 CRUD 왕복 검증 (2026-04-24)
 *
 * 공지사항(post_type=notice) + 메시지 템플릿 2개 도메인에서
 * 생성 → 조회 → 수정 → 삭제를 한 번 왕복하며 상태 전이와 UI 반영을
 * 실제 배포 서버에서 검증한다. Tenant 1 (hakwonplus) 한정.
 *
 * 생성 데이터는 cleanup_e2e_residue 패턴 [E2E-<ts>] 로 태깅되어
 * 실수 잔존 시 주기 cleanup으로 정리된다.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getApiBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const REPORT = "e2e/reports/prod-crud-roundtrip-2026-04-24.md";
const log: string[] = [];

function record(line: string) {
  log.push(line);
  console.log(line);
}

test.describe.configure({ mode: "serial" });

test("커뮤니티 공지 — 생성 → 수정 → 삭제", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));
  expect(token, "access token must exist").toBeTruthy();

  const ts = Date.now();
  const api = getApiBaseUrl();
  const tag = `[E2E-${ts}]`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "X-Tenant-Code": "hakwonplus",
  };

  // CREATE
  const createRes = await page.request.post(`${api}/api/v1/community/posts/`, {
    data: { post_type: "notice", title: `${tag} CRUD-test 공지`, content: "<p>생성 시점 본문</p>", node_ids: [] },
    headers,
  });
  record(`[notice] CREATE status=${createRes.status()}`);
  expect(createRes.status(), "create should be 201").toBe(201);
  const created = await createRes.json();
  const postId = created.id;
  expect(postId).toBeGreaterThan(0);
  record(`[notice] created id=${postId}`);

  // READ
  const readRes = await page.request.get(`${api}/api/v1/community/posts/${postId}/`, { headers });
  record(`[notice] READ status=${readRes.status()}`);
  expect(readRes.status()).toBe(200);
  const fetched = await readRes.json();
  expect(fetched.title).toBe(`${tag} CRUD-test 공지`);

  // UPDATE
  const updateRes = await page.request.patch(`${api}/api/v1/community/posts/${postId}/`, {
    data: { title: `${tag} CRUD-test 공지 (수정됨)`, content: "<p>수정된 본문</p>" },
    headers,
  });
  record(`[notice] UPDATE status=${updateRes.status()}`);
  expect(updateRes.status()).toBe(200);
  const updated = await updateRes.json();
  expect(updated.title).toContain("(수정됨)");
  expect(updated.content).toContain("수정된 본문");

  // UI 반영: 공지 탭에서 제목 확인
  await page.goto("https://hakwonplus.com/admin/community/notice", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const listText = await page.locator("body").innerText();
  expect(listText, "수정된 제목이 리스트에 반영되어야 함").toContain(`${tag} CRUD-test 공지 (수정됨)`);
  record(`[notice] UI 반영 확인 — 리스트에 수정된 제목 존재`);

  // DELETE
  const delRes = await page.request.delete(`${api}/api/v1/community/posts/${postId}/`, { headers });
  record(`[notice] DELETE status=${delRes.status()}`);
  expect([200, 204]).toContain(delRes.status());

  // 삭제 후 404
  const after = await page.request.get(`${api}/api/v1/community/posts/${postId}/`, { headers });
  record(`[notice] post-delete READ status=${after.status()}`);
  expect([404, 410]).toContain(after.status());
});

test("메시지 템플릿 — 생성 → 수정 → 삭제", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  const token = await page.evaluate(() => localStorage.getItem("access"));
  expect(token).toBeTruthy();

  const ts = Date.now();
  const api = getApiBaseUrl();
  const tag = `[E2E-${ts}]`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "X-Tenant-Code": "hakwonplus",
  };

  // CREATE
  const createRes = await page.request.post(`${api}/api/v1/messaging/templates/`, {
    data: {
      category: "default",
      name: `${tag} CRUD-test 템플릿`,
      subject: "",
      body: "안녕하세요, E2E CRUD 테스트 본문입니다.",
    },
    headers,
  });
  record(`[template] CREATE status=${createRes.status()}`);
  expect([200, 201]).toContain(createRes.status());
  const created = await createRes.json();
  const tplId = created.id;
  record(`[template] created id=${tplId}`);

  // READ
  const readRes = await page.request.get(`${api}/api/v1/messaging/templates/${tplId}/`, { headers });
  record(`[template] READ status=${readRes.status()}`);
  expect(readRes.status()).toBe(200);
  expect((await readRes.json()).name).toBe(`${tag} CRUD-test 템플릿`);

  // UPDATE
  const updateRes = await page.request.patch(`${api}/api/v1/messaging/templates/${tplId}/`, {
    data: { name: `${tag} CRUD-test 템플릿 (수정됨)`, body: "수정된 본문" },
    headers,
  });
  record(`[template] UPDATE status=${updateRes.status()}`);
  expect(updateRes.status()).toBe(200);
  const updated = await updateRes.json();
  expect(updated.name).toContain("(수정됨)");

  // UI 확인 — 메시지 템플릿 저장 탭
  await page.goto("https://hakwonplus.com/admin/message", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const text = await page.locator("body").innerText();
  expect(text, "수정된 템플릿 이름이 리스트에 반영되어야 함").toContain(`${tag} CRUD-test 템플릿 (수정됨)`);
  record(`[template] UI 반영 확인`);

  // DELETE
  const delRes = await page.request.delete(`${api}/api/v1/messaging/templates/${tplId}/`, { headers });
  record(`[template] DELETE status=${delRes.status()}`);
  expect([200, 204]).toContain(delRes.status());

  const after = await page.request.get(`${api}/api/v1/messaging/templates/${tplId}/`, { headers });
  record(`[template] post-delete READ status=${after.status()}`);
  expect([404, 410]).toContain(after.status());
});

test.afterAll(() => {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const out = ["# 운영 CRUD 왕복 검증 — 2026-04-24", "", ...log.map(l => `- ${l}`)];
  fs.writeFileSync(REPORT, out.join("\n"), "utf-8");
  console.log(`\nReport: ${REPORT}\n`);
});
