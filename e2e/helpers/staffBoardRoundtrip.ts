import { readFile } from "node:fs/promises";
import type { Page, APIRequestContext } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { api, expectApi, installQaStudentParentBoundary, loginApi, seedBrowserAuth, QA_API, QA_BASE, QA_STUDENT_PASSWORD, QA_TENANT } from "./qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";

const staffBoardQaFile = { name: "qa-staff-board.txt", text: "Private staff board QA document.\n" };
const path = "/staffs/board/posts/";

async function captureBoard(page: Page, surface: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath(`board-layout-staff-board-${surface}.png`) });
}

async function searchBoard(page: Page, value: string) {
  await page.getByRole("searchbox", { name: "게시글 검색어" }).fill(value);
  await page.getByRole("button", { name: "검색", exact: true }).click();
}

async function confirmDeletion(page: Page, label: "글 삭제" | "댓글 삭제", apiPath: string) {
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1${apiPath}` && r.request().method() === "DELETE"),
    page.getByRole("alertdialog", { name: label }).getByRole("button", { name: label, exact: true }).click(),
  ]);
  expect(response.status()).toBe(204);
}

export async function verifyStaffBoard(page: Page, request: APIRequestContext, admin: string, student: string) {
  const stamp = Date.now();
  const account = `qa-board-${stamp}`;
  await expectApi(request, "POST", "/staffs/", admin, {
    name: "QA 교직원 게시판 조교", phone: "", role: "ASSISTANT", position: "ASSISTANT",
    pay_type: "HOURLY", username: account, password: QA_STUDENT_PASSWORD,
  });
  const assistantTokens = await loginApi(request, account, QA_STUDENT_PASSWORD);
  const assistant = assistantTokens.access;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${QA_BASE}/workspace/dashboard`);
  await acknowledgeInitialAccountPromptsIfVisible(page);
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "교직원 게시판" }).click();
  function replayHeaders(key: string) {
    return { Authorization: `Bearer ${admin}`, "X-Tenant-Code": QA_TENANT, "Idempotency-Key": key };
  }
  const title = `QA 교직원 회의 안내 ${stamp}`;
  async function create(view: Page, action: "공지 작성" | "자료 올리기" | "글쓰기", title: string, body: string, attachment = false) {
    await view.getByRole("button", { name: action, exact: true }).click();
    const dialog = view.getByRole("dialog");
    await dialog.getByLabel("제목", { exact: true }).fill(title);
    await dialog.getByLabel("내용", { exact: true }).fill(body);
    if (attachment) await dialog.locator('input[type="file"]').setInputFiles({
      name: staffBoardQaFile.name, mimeType: "text/plain", buffer: Buffer.from(staffBoardQaFile.text),
    });
    const created = view.waitForResponse(r => new URL(r.url()).pathname.endsWith(path) && r.request().method() === "POST");
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    await expect(view.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const key = await response.request().headerValue("idempotency-key");
    expect(key).toMatch(/^[a-f0-9-]{36}$/);
    return { id: Number((await response.json()).id), key: key! };
  }
  const noticeBody = "금요일 수업 전 교무실에서 만나요.";
  await expect(page.getByRole("tab", { name: "전체 글" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "글쓰기", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "공지사항" }).click();
  const { id, key } = await create(page, "공지 작성", title, noticeBody);
  const replayedNotice = await request.post(`${QA_API}/api/v1${path}`, {
    headers: replayHeaders(key), data: { category: "notice", title, body: noticeBody },
  });
  expect(replayedNotice.status()).toBe(200);
  expect(await replayedNotice.json()).toMatchObject({ id });
  await page.getByRole("link", { name: "공지사항 목록" }).click();
  const keyword = String(stamp);
  await searchBoard(page, keyword);
  await page.getByRole("link", { name: title, exact: false }).click();
  const updated = title + " (시간 변경)";
  await page.getByRole("button", { name: "글 수정" }).click();
  await page.getByRole("dialog").getByLabel("제목", { exact: true }).fill(updated);
  await page.getByRole("button", { name: "수정 저장" }).click();
  await expect(page.getByRole("heading", { name: updated })).toBeVisible();
  await expect(page).toHaveURL(url => url.searchParams.get("q") === keyword);
  await page.getByRole("link", { name: "공지사항 목록" }).click();
  await expect(page.getByRole("searchbox", { name: "게시글 검색어" })).toHaveValue(keyword);
  const returnedNotice = page.getByRole("link", { name: updated, exact: false });
  await expect(returnedNotice).toBeFocused();
  await expect(returnedNotice).toBeInViewport();
  await captureBoard(page, "notice-search-1366");

  let assistantReplyId: number;
  const mobileContext = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  try {
    const mobile = await mobileContext.newPage();
    const boundary = await installQaStudentParentBoundary(mobile, request);
    await seedBrowserAuth(mobile, assistantTokens);
    await mobile.goto(`${QA_BASE}/workspace/mobile`);
    await acknowledgeInitialAccountPromptsIfVisible(mobile);
    const bottom = mobile.getByRole("navigation", { name: "하단 메뉴" });
    const home = bottom.getByRole("link", { name: "대시보드" });
    await expect(home).toHaveAttribute("href", "/workspace/mobile");
    const notices = mobile.getByRole("region", { name: "학원 내부 공지" });
    await expect(notices.getByRole("link", { name: updated, exact: false })).toHaveAttribute(
      "href", `/workspace/mobile/staff-board/notice/${id}`,
    );
    await mobile.getByRole("button", { name: "메뉴", exact: true }).click();
    await mobile.getByRole("navigation", { name: "선생님 메뉴" }).getByRole("button", { name: /오늘 업무/ }).click();
    await mobile.getByRole("button", { name: "교직원 게시판", exact: true }).click();
    await expect(mobile).toHaveURL(url => url.pathname === "/workspace/mobile/staff-board/all");
    await expect(home).toBeVisible();
    await searchBoard(mobile, keyword);
    await mobile.getByRole("link", { name: updated, exact: false }).click();
    await expect(mobile).toHaveURL(url => url.pathname === `/workspace/mobile/staff-board/all/${id}` && url.searchParams.get("q") === keyword);
    await expect(mobile.getByRole("button", { name: "글 수정" })).toHaveCount(0);
    await expect(mobile.getByRole("button", { name: "글 삭제" })).toHaveCount(0);
    await mobile.getByLabel("댓글 내용").fill("조교도 참석합니다.");
    const created = mobile.waitForResponse(r => new URL(r.url()).pathname.endsWith(`${path}${id}/replies/`) && r.request().method() === "POST");
    await mobile.getByRole("button", { name: "댓글 등록" }).click();
    const createdReply = await created;
    expect(createdReply.status()).toBe(201);
    assistantReplyId = (await createdReply.json()).id;
    expect(assistantReplyId).toBeGreaterThan(0);
    await mobile.reload();
    await expect(mobile.getByText("조교도 참석합니다.", { exact: true })).toHaveCount(1);
    await mobile.getByRole("button", { name: "댓글 수정", exact: true }).click();
    await mobile.getByLabel("댓글 수정 내용").fill("조교는 수업 후 참석합니다.");
    await mobile.getByRole("button", { name: "댓글 수정 저장" }).click();
    await expect(mobile.getByText("조교는 수업 후 참석합니다.", { exact: true })).toBeVisible();
    await mobile.reload();
    await expect(mobile.getByText("조교는 수업 후 참석합니다.", { exact: true })).toBeVisible();
    await expect(mobile.getByRole("button", { name: "댓글 삭제", exact: true })).toBeVisible();
    await expect(home).toBeVisible();
    await captureBoard(mobile, "assistant-detail-390");
    await mobile.getByRole("link", { name: "전체 글 목록" }).click();
    await expect(mobile.getByRole("searchbox", { name: "게시글 검색어" })).toHaveValue(keyword);
    await captureBoard(mobile, "assistant-search-390");

    const assistantTitle = `조교 교대 기록 ${stamp}`;
    const assistantPost = await create(mobile, "글쓰기", assistantTitle, "다음 수업 교대 기록입니다.");
    await expect(mobile.getByRole("button", { name: "글 수정", exact: true })).toBeVisible();
    await expect(mobile.getByRole("button", { name: "글 삭제", exact: true })).toBeVisible();
    await mobile.getByRole("link", { name: "전체 글 목록" }).click();
    await searchBoard(mobile, assistantTitle);
    await expect(mobile.getByRole("link", { name: assistantTitle, exact: false })).toBeVisible();

    await page.getByRole("tab", { name: "전체 글" }).click();
    await searchBoard(page, assistantTitle);
    await page.getByRole("link", { name: assistantTitle, exact: false }).click();
    await expect(page.getByRole("heading", { name: assistantTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "글 수정", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "글 삭제", exact: true }).click();
    await confirmDeletion(page, "글 삭제", `${path}${assistantPost.id}/`);
    await mobile.reload();
    await expect(mobile.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
    expect((await api(request, "GET", `${path}${assistantPost.id}/`, assistant)).status).toBe(404);

    await home.click();
    await expect(mobile).toHaveURL(url => url.pathname === "/workspace/mobile");
    await expect(notices.getByRole("link", { name: updated, exact: false })).toBeVisible();
    boundary.assertClean();
  } finally {
    await mobileContext.close();
  }
  for (const width of [1366, 1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${QA_BASE}/workspace/dashboard`);
    const panel = page.getByRole("region", { name: "학원 내부 공지" });
    await expect(panel.getByRole("link", { name: updated, exact: false })).toBeVisible();
    await captureBoard(page, `dashboard-${width}`);
    await panel.getByRole("link", { name: updated, exact: false }).click();
    await expect(page.getByText("조교는 수업 후 참석합니다.", { exact: true })).toBeVisible();
    await captureBoard(page, `detail-${width}`);
  }
  const replyBody = "회의 후 자료실에 올려 주세요.";
  await page.getByLabel("댓글 내용").fill(replyBody);
  const replyPath = `${path}${id}/replies/`;
  const replyCreated = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith(replyPath) && response.request().method() === "POST");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  const replyResponse = await replyCreated;
  expect(replyResponse.status()).toBe(201);
  const replyKey = await replyResponse.request().headerValue("idempotency-key");
  expect(replyKey).toMatch(/^[a-f0-9-]{36}$/);
  const replayedReply = await request.post(`${QA_API}/api/v1${replyPath}`, {
    headers: replayHeaders(replyKey!), data: { body: replyBody },
  });
  expect(replayedReply.status()).toBe(200);
  expect(await replayedReply.json()).toMatchObject({ id: (await replyResponse.json()).id });
  await page.reload();
  await expect(page.getByText(replyBody, { exact: true })).toHaveCount(1);
  const ownReply = page.getByRole("listitem").filter({ hasText: replyBody });
  await ownReply.getByRole("button", { name: "댓글 삭제" }).click();
  await page.getByRole("alertdialog", { name: "댓글 삭제" }).getByRole("button", { name: "취소" }).click();
  await expect(ownReply).toBeVisible();
  await ownReply.getByRole("button", { name: "댓글 삭제" }).click();
  await page.getByRole("alertdialog", { name: "댓글 삭제" }).getByRole("button", { name: "댓글 삭제" }).click();
  await expect(ownReply).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("조교는 수업 후 참석합니다.", { exact: true })).toBeVisible();
  await expect(ownReply).toHaveCount(0);
  const assistantReply = page.getByRole("listitem").filter({ hasText: "조교는 수업 후 참석합니다." });
  await expect(assistantReply.getByRole("button", { name: "댓글 수정", exact: true })).toHaveCount(0);
  await assistantReply.getByRole("button", { name: "댓글 삭제", exact: true }).click();
  await confirmDeletion(page, "댓글 삭제", `${replyPath}${assistantReplyId}/`);
  await expect(assistantReply).toHaveCount(0);
  const noticeAfterModeration = await expectApi(request, "GET", `${path}${id}/`, assistant);
  expect(noticeAfterModeration).toMatchObject({ id, title: updated, reply_count: 0, replies: [] });
  await page.getByRole("tab", { name: "자료실" }).click();
  const resourceTitle = `회의 자료 ${stamp}`;
  const resourceBody = "조교용 회의 메모입니다.";
  const resource = await create(page, "자료 올리기", resourceTitle, resourceBody, true);
  const replayedResource = await request.post(`${QA_API}/api/v1${path}`, {
    headers: replayHeaders(resource.key),
    multipart: { category: "resource", title: resourceTitle, body: resourceBody,
      file: { name: staffBoardQaFile.name, mimeType: "text/plain", buffer: Buffer.from(staffBoardQaFile.text) } },
  });
  expect(replayedResource.status()).toBe(200);
  expect(await replayedResource.json()).toMatchObject({ id: resource.id });
  await page.reload();
  await page.getByRole("link", { name: "자료실 목록" }).click();
  await searchBoard(page, `empty-${stamp}`);
  await expect(page.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "검색 초기화" }).click();
  await expect(page.getByRole("searchbox", { name: "게시글 검색어" })).toHaveValue("");
  await searchBoard(page, staffBoardQaFile.name);
  const fileResult = page.getByRole("link", { name: resourceTitle, exact: false });
  await expect(fileResult.getByText(staffBoardQaFile.name, { exact: true })).toBeVisible();
  await captureBoard(page, "resource-filename-390");
  await fileResult.click();
  await expect(page).toHaveURL(url => url.searchParams.get("q") === staffBoardQaFile.name);
  const attachmentPath = `${path}${resource.id}/attachment/`;
  const resourceUrl = page.url();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: staffBoardQaFile.name + " 다운로드" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(staffBoardQaFile.name);
  expect(await readFile((await download.path())!, "utf8")).toBe(staffBoardQaFile.text);
  await expect(page).toHaveURL(resourceUrl);
  expect((await api(request, "GET", attachmentPath, student)).status).toBe(403);
  expect((await api(request, "DELETE", attachmentPath, assistant)).status).toBe(403);
  expect((await api(request, "GET", `${path}${id}/`, student)).status).toBe(403);
  await page.getByRole("button", { name: "첨부파일 제거", exact: true }).click();
  const removal = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(attachmentPath)
    && response.request().method() === "DELETE");
  await page.getByRole("alertdialog", { name: "첨부파일 제거" })
    .getByRole("button", { name: "첨부파일 제거", exact: true }).click();
  expect((await removal).status()).toBe(204);
  await expect(page.getByText("첨부파일을 제거했습니다.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: resourceTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: staffBoardQaFile.name + " 다운로드" })).toHaveCount(0);
  expect((await api(request, "GET", attachmentPath, assistant)).status).toBe(404);
  await page.getByRole("tab", { name: "전체 글" }).click();
  const { id: free } = await create(page, "글쓰기", `수업 인수인계 ${stamp}`, "다음 수업 준비 내용을 남깁니다.");
  const read = await expectApi<{ body: string; can_edit: boolean }>(request, "GET", `${path}${free}/`, assistant);
  expect(read).toMatchObject({ body: "다음 수업 준비 내용을 남깁니다.", can_edit: false });
  await page.getByRole("button", { name: "글 삭제", exact: true }).click();
  await page.getByRole("alertdialog", { name: "글 삭제" }).getByRole("button", { name: "글 삭제" }).click();
  await expect(page.getByRole("button", { name: "글쓰기", exact: true })).toBeVisible();
  await page.reload();
  await searchBoard(page, `수업 인수인계 ${stamp}`);
  await expect(page.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
  expect((await api(request, "GET", `${path}${free}/`, assistant)).status).toBe(404);
}
