import { readFile } from "node:fs/promises";
import type { Page, APIRequestContext } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { api, expectApi, loginApi, QA_BASE, QA_STUDENT_PASSWORD } from "./qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import { staffBoardQaFile } from "./releaseApiBoundary";

export async function verifyStaffBoard(page: Page, request: APIRequestContext, admin: string, student: string) {
  const stamp = Date.now();
  const account = `qa-board-${stamp}`;
  await expectApi(request, "POST", "/staffs/", admin, {
    name: "QA 교직원 게시판 조교", phone: "", role: "ASSISTANT", position: "ASSISTANT",
    pay_type: "HOURLY", username: account, password: QA_STUDENT_PASSWORD,
  });
  const assistant = (await loginApi(request, account, QA_STUDENT_PASSWORD)).access;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${QA_BASE}/workspace/dashboard`);
  await acknowledgeInitialAccountPromptsIfVisible(page);
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "교직원 게시판" }).click();
  const path = "/staffs/board/posts/";
  const title = `QA 교직원 회의 안내 ${stamp}`;
  async function create(title: string, body: string, attachment = false) {
    await page.getByRole("button", { name: "글쓰기", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("제목", { exact: true }).fill(title);
    await dialog.getByLabel("내용", { exact: true }).fill(body);
    if (attachment) await dialog.locator('input[type="file"]').setInputFiles({
      name: staffBoardQaFile.name, mimeType: "text/plain", buffer: Buffer.from(staffBoardQaFile.text),
    });
    const created = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(path) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    return Number((await response.json()).id);
  }
  const id = await create(title, "금요일 수업 전 교무실에서 만나요.");
  const updated = title + " (시간 변경)";
  await page.getByRole("button", { name: "글 수정" }).click();
  await page.getByRole("dialog").getByLabel("제목", { exact: true }).fill(updated);
  await page.getByRole("button", { name: "수정 저장" }).click();
  await expect(page.getByRole("heading", { name: updated })).toBeVisible();
  await expectApi(request, "POST", `${path}${id}/replies/`, assistant, { body: "조교도 참석합니다." });
  for (const width of [1366, 1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${QA_BASE}/workspace/dashboard`);
    const panel = page.getByRole("region", { name: "학원 내부 공지" });
    await expect(panel.getByRole("link", { name: updated, exact: false })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`staff-board-dashboard-${width}.png`) });
    await panel.getByRole("link", { name: updated, exact: false }).click();
    await expect(page.getByText("조교도 참석합니다.", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`staff-board-detail-${width}.png`) });
  }
  await page.getByLabel("댓글 내용").fill("회의 후 자료실에 올려 주세요.");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.getByText("회의 후 자료실에 올려 주세요.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("회의 후 자료실에 올려 주세요.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "자료실" }).click();
  const resource = await create(`회의 자료 ${stamp}`, "조교용 회의 메모입니다.", true);
  await page.reload();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: staffBoardQaFile.name + " 다운로드" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(staffBoardQaFile.name);
  expect(await readFile((await download.path())!, "utf8")).toBe(staffBoardQaFile.text);
  expect((await api(request, "GET", `${path}${resource}/download/`, student)).status).toBe(403);
  expect((await api(request, "GET", `${path}${id}/`, student)).status).toBe(403);
  await page.getByRole("tab", { name: "자유게시글" }).click();
  const free = await create(`수업 인수인계 ${stamp}`, "다음 수업 준비 내용을 남깁니다.");
  const read = await expectApi<{ body: string; can_edit: boolean }>(request, "GET", `${path}${free}/`, assistant);
  expect(read).toMatchObject({ body: "다음 수업 준비 내용을 남깁니다.", can_edit: false });
}
