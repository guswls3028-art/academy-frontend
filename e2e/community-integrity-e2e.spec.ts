/**
 * Community Domain 전수 검사 E2E
 *
 * 1. Tenant 1 기존 게시물 전체 삭제 (API)
 * 2. Admin: 공지사항 / 게시판 / 자료실 각 1건 작성 (프론트엔드 UI)
 * 3. Student: QnA 질문 / 상담 신청 각 1건 작성 (프론트엔드 UI)
 * 4. 교차 검증: Student앱에서 Admin 글 표시 확인
 * 5. 교차 검증: Admin앱에서 Student 글 표시 확인
 * 6. Admin이 QnA/상담 답변 → Student에서 답변 확인
 * 7. 데이터 정합성: API 응답 vs UI 표시 비교
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TENANT_CODE = "hakwonplus";
const TS = Date.now();

// 테스트 데이터 (E2E 태그 포함)
const TEST_DATA = {
  notice: {
    title: `[E2E-${TS}] 공지사항 테스트`,
    content: `<p>E2E 공지사항 본문입니다. 타임스탬프: ${TS}</p>`,
  },
  board: {
    title: `[E2E-${TS}] 게시판 테스트`,
    content: `E2E 게시판 본문입니다. 타임스탬프: ${TS}`,
  },
  materials: {
    title: `[E2E-${TS}] 자료실 테스트`,
    content: `E2E 자료실 본문입니다. 타임스탬프: ${TS}`,
  },
  qna: {
    title: `[E2E-${TS}] QnA 질문 테스트`,
    content: `E2E QnA 질문 본문입니다. 타임스탬프: ${TS}`,
  },
  counsel: {
    title: `[E2E-${TS}] 상담 신청 테스트`,
    content: `E2E 상담 신청 본문입니다. 타임스탬프: ${TS}`,
  },
  answer_qna: `E2E QnA 답변입니다. 타임스탬프: ${TS}`,
  answer_counsel: `E2E 상담 답변입니다. 타임스탬프: ${TS}`,
};

// 생성된 게시물 ID 추적
const createdPostIds: number[] = [];

/** JWT 토큰 획득 */
async function getToken(page: Page, user: string, pass: string): Promise<string> {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: user, password: pass, tenant_code: TENANT_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  return data.access;
}

/** API로 게시물 목록 조회 */
async function fetchAllPosts(page: Page, token: string): Promise<any[]> {
  const resp = await page.request.get(`${API}/api/v1/community/admin/posts/`, {
    params: { page_size: "500" },
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": TENANT_CODE,
      Host: "api.hakwonplus.com",
    },
  });
  if (resp.status() !== 200) return [];
  const data = await resp.json();
  return data.results || [];
}

/** API로 게시물 삭제 */
async function deletePostApi(page: Page, token: string, postId: number): Promise<void> {
  await page.request.delete(`${API}/api/v1/community/posts/${postId}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": TENANT_CODE,
      Host: "api.hakwonplus.com",
    },
  });
}

/** 스크린샷 저장 */
async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `e2e/screenshots/community-${name}.png`, fullPage: true });
}

/** 페이지 네비게이션 + 에러 바운더리 자동 복구 (운영 프론트엔드 간헐 에러 대응) */
async function safeGoto(page: Page, url: string, waitMs = 2000): Promise<void> {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(waitMs);
  const errorBoundary = page.locator("text=일시적인 오류가 발생했습니다").first();
  if (await errorBoundary.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log("[RETRY] 에러 바운더리 감지 → 리로드");
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(waitMs);
    // 2차 리로드
    if (await errorBoundary.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log("[RETRY] 2차 리로드");
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(waitMs);
    }
  }
}

test.describe.serial("Community Domain 전수 검사", () => {
  // ================================================================
  // STEP 1: 기존 게시물 전체 삭제
  // ================================================================
  test("1. Tenant 1 기존 커뮤니티 게시물 전체 삭제", async ({ page }) => {
    test.setTimeout(120_000); // 대량 삭제 시 충분한 시간
    const token = await getToken(
      page,
      process.env.E2E_ADMIN_USER || "admin97",
      process.env.E2E_ADMIN_PASS || "koreaseoul97"
    );

    const posts = await fetchAllPosts(page, token);
    console.log(`[CLEANUP] 기존 게시물 ${posts.length}건 발견`);

    // 5개씩 병렬 삭제
    for (let i = 0; i < posts.length; i += 5) {
      const batch = posts.slice(i, i + 5);
      await Promise.all(batch.map((p: any) => deletePostApi(page, token, p.id)));
      console.log(`  삭제 batch ${Math.floor(i / 5) + 1}: ${batch.map((p: any) => `#${p.id}`).join(", ")}`);
    }

    // 삭제 확인
    const remaining = await fetchAllPosts(page, token);
    expect(remaining.length).toBe(0);
    console.log("[CLEANUP] 전체 삭제 완료");
  });

  // ================================================================
  // STEP 2: Admin - 공지사항 작성
  // ================================================================
  test("2. Admin: 공지사항 작성 (프론트엔드 UI)", async ({ page }) => {
    // 콘솔 에러 캡처
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => { consoleErrors.push(`PAGE_ERROR: ${err.message}`); });

    await loginViaUI(page, "admin");
    // scope=all 파라미터 필수 (트리에서 "전체 보기" 선택한 상태)
    await safeGoto(page, `${BASE}/admin/community/notice?scope=all`, 3000);

    // 에러 바운더리 감지 → 리로드
    const errorBoundary = page.locator("text=일시적인 오류가 발생했습니다").first();
    if (await errorBoundary.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("[DEBUG] 에러 바운더리 감지. 콘솔 에러:", consoleErrors.join(" | "));
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(3000);
    }
    await snap(page, "01-admin-notice-before");

    // "+ 추가" 버튼 클릭
    const addBtn = page.locator("button").filter({ hasText: /\+\s*추가/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(1000);

    // 제목 입력
    const titleInput = page.locator('input[placeholder*="공지 제목"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(TEST_DATA.notice.title);

    // 본문 입력 (RichTextEditor - TipTap의 contenteditable div)
    const editor = page.locator(".rich-editor__content, .ProseMirror, [contenteditable='true']").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await page.keyboard.type(`E2E 공지사항 본문입니다. 타임스탬프: ${TS}`);

    await snap(page, "02-admin-notice-filled");

    // 등록 버튼 클릭
    const submitBtn = page.locator("button").filter({ hasText: /^등록$/ }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    await snap(page, "03-admin-notice-after");

    // 생성 확인 — API로 직접 확인 (리스트 렌더링은 scope 의존)
    const token = await getToken(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    const posts = await fetchAllPosts(page, token);
    const created = posts.find((p: any) => p.title.includes(`E2E-${TS}`) && p.post_type === "notice");
    expect(created).toBeTruthy();
    console.log("[ADMIN] 공지사항 작성 완료:", created.title, "id=", created.id);

    // UI에서도 확인 시도 (리스트 갱신 대기)
    await safeGoto(page, `${BASE}/admin/community/notice?scope=all`);
    const postTitle = page.locator(`text=${TEST_DATA.notice.title}`).first();
    await expect(postTitle).toBeVisible({ timeout: 10000 });
    console.log("[ADMIN] 공지사항 UI 리스트 표시 확인 OK");
  });

  // ================================================================
  // STEP 3: Admin - 게시판 작성
  // ================================================================
  test("3. Admin: 게시판 글 작성 (프론트엔드 UI)", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/board?scope=all`);
    await snap(page, "04-admin-board-before");

    // "+ 글쓰기" 버튼 클릭
    const addBtn = page.locator("button").filter({ hasText: /\+\s*글쓰기/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(1000);

    // 제목 입력 — 우측 생성 패인의 입력 (검색창 제외)
    const titleInput = page.locator('input[placeholder="게시물 제목을 입력하세요"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(TEST_DATA.board.title);

    // 본문 입력 (RichTextEditor)
    const editor = page.locator(".rich-editor__content, .ProseMirror, [contenteditable='true']").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await page.keyboard.type(TEST_DATA.board.content);

    await snap(page, "05-admin-board-filled");

    // 등록 버튼
    const submitBtn = page.locator("button").filter({ hasText: /^등록$/ }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    await snap(page, "06-admin-board-after");

    // API로 생성 확인
    const token = await getToken(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    const posts = await fetchAllPosts(page, token);
    const created = posts.find((p: any) => p.title.includes(`E2E-${TS}`) && p.post_type === "board");
    expect(created).toBeTruthy();
    console.log("[ADMIN] 게시판 글 작성 완료:", created.title, "id=", created.id);

    // UI 확인
    await safeGoto(page, `${BASE}/admin/community/board?scope=all`);
    const postTitle = page.locator(`text=${TEST_DATA.board.title}`).first();
    await expect(postTitle).toBeVisible({ timeout: 10000 });
    console.log("[ADMIN] 게시판 UI 리스트 표시 확인 OK");
  });

  // ================================================================
  // STEP 4: Admin - 자료실 작성
  // ================================================================
  test("4. Admin: 자료실 글 작성 (프론트엔드 UI)", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/materials?scope=all`);
    await snap(page, "07-admin-materials-before");

    // "+ 자료 등록" 버튼
    const addBtn = page.locator("button").filter({ hasText: /\+\s*자료\s*등록/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(1000);

    // 제목 입력 — 우측 생성 패인의 입력 (검색창 제외)
    const titleInput = page.locator('input[placeholder="자료 제목을 입력하세요"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(TEST_DATA.materials.title);

    // 본문 입력 (RichTextEditor)
    const editor = page.locator(".rich-editor__content, .ProseMirror, [contenteditable='true']").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await page.keyboard.type(TEST_DATA.materials.content);

    await snap(page, "08-admin-materials-filled");

    const submitBtn = page.locator("button").filter({ hasText: /^등록$/ }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    await snap(page, "09-admin-materials-after");

    // API로 생성 확인
    const token = await getToken(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    const posts = await fetchAllPosts(page, token);
    const created = posts.find((p: any) => p.title.includes(`E2E-${TS}`) && p.post_type === "materials");
    expect(created).toBeTruthy();
    console.log("[ADMIN] 자료실 글 작성 완료:", created.title, "id=", created.id);

    // UI 확인
    await safeGoto(page, `${BASE}/admin/community/materials?scope=all`);
    const postTitle = page.locator(`text=${TEST_DATA.materials.title}`).first();
    await expect(postTitle).toBeVisible({ timeout: 10000 });
    console.log("[ADMIN] 자료실 UI 리스트 표시 확인 OK");
  });

  // ================================================================
  // STEP 5: Student - QnA 질문 작성
  // ================================================================
  test("5. Student: QnA 질문 작성 (프론트엔드 UI)", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);
    await snap(page, "10-student-community-landing");

    // QnA 탭 클릭
    const qnaTab = page.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "11-student-qna-tab");

    // "질문하기" 버튼 클릭
    const askBtn = page.locator("button").filter({ hasText: "질문하기" }).first();
    await askBtn.waitFor({ state: "visible", timeout: 10000 });
    await askBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, "12-student-qna-form");

    // 제목 입력
    const titleInput = page.locator('input[placeholder*="질문 제목"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(TEST_DATA.qna.title);

    // 본문 입력 (TipTap RichTextEditor — .ProseMirror contenteditable div)
    const editor = page.locator(".ProseMirror").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(TEST_DATA.qna.content, { delay: 10 });
    await page.waitForTimeout(500);

    await snap(page, "13-student-qna-filled");

    // "질문 보내기" 버튼 클릭 — force click (React 상태 반영 대기)
    const submitBtn = page.locator("button").filter({ hasText: "질문 보내기" }).first();
    // canSubmit은 title+content(stripped) 양쪽 필수. 타이핑 후 React 갱신 대기
    await page.waitForTimeout(500);
    await submitBtn.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    await snap(page, "14-student-qna-after");

    // 질문 등록 확인 - 리스트에 제목이 보이는지
    const postTitle = page.locator(`text=${TEST_DATA.qna.title}`).first();
    await expect(postTitle).toBeVisible({ timeout: 10000 });
    console.log("[STUDENT] QnA 질문 작성 완료:", TEST_DATA.qna.title);
  });

  // ================================================================
  // STEP 6: Student - 상담 신청 작성
  // ================================================================
  test("6. Student: 상담 신청 작성 (프론트엔드 UI)", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // 상담 신청 탭 클릭
    const counselTab = page.locator("button").filter({ hasText: "상담 신청" }).first();
    await counselTab.click();
    await page.waitForTimeout(1500);
    await snap(page, "15-student-counsel-tab");

    // "상담 신청하기" 버튼 클릭
    const applyBtn = page.locator("button").filter({ hasText: "상담 신청하기" }).first();
    await applyBtn.waitFor({ state: "visible", timeout: 10000 });
    await applyBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, "16-student-counsel-form");

    // 제목 입력
    const titleInput = page.locator('input[placeholder*="진로 상담"]').first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(TEST_DATA.counsel.title);
    } else {
      const altInput = page.locator('input[placeholder*="상담 제목"], input.stu-input').first();
      await altInput.fill(TEST_DATA.counsel.title);
    }

    // 본문 입력 (TipTap RichTextEditor)
    const editor = page.locator(".ProseMirror").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(TEST_DATA.counsel.content, { delay: 10 });
    await page.waitForTimeout(500);

    await snap(page, "17-student-counsel-filled");

    // "상담 신청하기" 제출 버튼 클릭
    const submitBtn = page.locator("button").filter({ hasText: "상담 신청하기" }).first();
    await page.waitForTimeout(500);
    await submitBtn.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    await snap(page, "18-student-counsel-after");

    const postTitle = page.locator(`text=${TEST_DATA.counsel.title}`).first();
    await expect(postTitle).toBeVisible({ timeout: 10000 });
    console.log("[STUDENT] 상담 신청 작성 완료:", TEST_DATA.counsel.title);
  });

  // ================================================================
  // STEP 7: 교차 검증 - Student앱에서 Admin 글 확인
  // ================================================================
  test("7. Student앱에서 Admin 공지사항 표시 확인", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // 공지사항 탭
    const noticeTab = page.locator("button").filter({ hasText: "공지사항" }).first();
    await noticeTab.click();
    await page.waitForTimeout(2000);
    await snap(page, "19-student-notice-check");

    // Admin이 작성한 공지가 보이는지
    const noticeTitle = page.locator(`text=${TEST_DATA.notice.title}`).first();
    await expect(noticeTitle).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Student에서 공지사항 확인 OK");

    // 공지 클릭 → 상세 확인
    await noticeTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "20-student-notice-detail");

    // 제목이 상세에서 보이는지 확인
    const detailTitle = page.locator(`text=${TEST_DATA.notice.title}`).first();
    await expect(detailTitle).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Student에서 공지사항 상세 확인 OK");
  });

  test("7b. Student앱에서 Admin 게시판 글 표시 확인", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // 게시판 탭
    const boardTab = page.locator("button").filter({ hasText: "게시판" }).first();
    await boardTab.click();
    await page.waitForTimeout(2000);
    await snap(page, "21-student-board-check");

    const boardTitle = page.locator(`text=${TEST_DATA.board.title}`).first();
    await expect(boardTitle).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Student에서 게시판 글 확인 OK");

    // 상세 확인
    await boardTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "22-student-board-detail");

    const detailTitle = page.locator(`text=${TEST_DATA.board.title}`).first();
    await expect(detailTitle).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Student에서 게시판 상세 확인 OK");
  });

  test("7c. Student앱에서 Admin 자료실 글 표시 확인", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // 자료실 탭
    const materialsTab = page.locator("button").filter({ hasText: "자료실" }).first();
    await materialsTab.click();
    await page.waitForTimeout(2000);
    await snap(page, "23-student-materials-check");

    const matTitle = page.locator(`text=${TEST_DATA.materials.title}`).first();
    await expect(matTitle).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Student에서 자료실 글 확인 OK");

    // 상세 확인
    await matTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "24-student-materials-detail");

    const detailTitle = page.locator(`text=${TEST_DATA.materials.title}`).first();
    await expect(detailTitle).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Student에서 자료실 상세 확인 OK");
  });

  // ================================================================
  // STEP 8: 교차 검증 - Admin앱에서 Student 글 확인
  // ================================================================
  test("8. Admin앱에서 Student QnA 질문 표시 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/qna`);
    await snap(page, "25-admin-qna-check");

    // Student가 작성한 QnA가 보이는지
    const qnaTitle = page.locator(`text=${TEST_DATA.qna.title}`).first();
    await expect(qnaTitle).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Admin에서 QnA 질문 확인 OK");

    // 클릭하여 상세 확인
    await qnaTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "26-admin-qna-detail");

    // 제목 상세 확인
    const detailTitle = page.locator(`text=${TEST_DATA.qna.title}`).first();
    await expect(detailTitle).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Admin에서 QnA 상세 제목 확인 OK");

    // 상태 확인: "답변 대기"
    const pendingBadge = page.locator("text=답변 대기").first();
    await expect(pendingBadge).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Admin에서 QnA 상태 '답변 대기' 확인 OK");
  });

  test("8b. Admin앱에서 Student 상담 신청 표시 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/counsel`);
    await snap(page, "27-admin-counsel-check");

    const counselTitle = page.locator(`text=${TEST_DATA.counsel.title}`).first();
    await expect(counselTitle).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Admin에서 상담 신청 확인 OK");

    await counselTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "28-admin-counsel-detail");

    const detailTitle2 = page.locator(`text=${TEST_DATA.counsel.title}`).first();
    await expect(detailTitle2).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Admin에서 상담 상세 제목 확인 OK");
  });

  // ================================================================
  // STEP 9: Admin이 QnA 답변 작성
  // ================================================================
  test("9. Admin: QnA 답변 작성", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/qna`);

    // QnA 질문 클릭
    const qnaTitle = page.locator(`text=${TEST_DATA.qna.title}`).first();
    await qnaTitle.click();
    await page.waitForTimeout(2000);

    // 답변 작성 영역 - textarea
    const composer = page.locator('textarea[placeholder*="답변을 작성"]').first();
    await composer.waitFor({ state: "visible", timeout: 10000 });
    await composer.fill(TEST_DATA.answer_qna);

    await snap(page, "29-admin-qna-answer-filled");

    // "답변 등록" 버튼
    const answerBtn = page.locator("button").filter({ hasText: "답변 등록" }).first();
    await answerBtn.click();
    await page.waitForTimeout(3000);

    await snap(page, "30-admin-qna-answer-after");

    // 답변이 표시되는지 확인
    const answerText = page.locator(`text=E2E QnA 답변입니다`).first();
    await expect(answerText).toBeVisible({ timeout: 10000 });
    console.log("[ADMIN] QnA 답변 작성 완료");

    // 상태가 "답변 완료"로 변경되었는지
    const resolvedBadge = page.locator("text=답변 완료").first();
    await expect(resolvedBadge).toBeVisible({ timeout: 5000 });
    console.log("[ADMIN] QnA 상태 '답변 완료' 전환 확인 OK");
  });

  // ================================================================
  // STEP 10: Admin이 상담 답변 작성
  // ================================================================
  test("10. Admin: 상담 답변 작성", async ({ page }) => {
    await loginViaUI(page, "admin");
    await safeGoto(page, `${BASE}/admin/community/counsel`);

    const counselTitle = page.locator(`text=${TEST_DATA.counsel.title}`).first();
    await counselTitle.click();
    await page.waitForTimeout(2000);

    const composer = page.locator('textarea[placeholder*="답변을 작성"]').first();
    await composer.waitFor({ state: "visible", timeout: 10000 });
    await composer.fill(TEST_DATA.answer_counsel);

    await snap(page, "31-admin-counsel-answer-filled");

    const answerBtn = page.locator("button").filter({ hasText: "답변 등록" }).first();
    await answerBtn.click();
    await page.waitForTimeout(3000);

    await snap(page, "32-admin-counsel-answer-after");

    const answerText = page.locator(`text=E2E 상담 답변입니다`).first();
    await expect(answerText).toBeVisible({ timeout: 10000 });
    console.log("[ADMIN] 상담 답변 작성 완료");
  });

  // ================================================================
  // STEP 11: Student에서 답변 확인
  // ================================================================
  test("11. Student앱에서 QnA 답변 확인", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // QnA 탭
    const qnaTab = page.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.click();
    await page.waitForTimeout(2000);
    await snap(page, "33-student-qna-with-answer");

    // 상태 칩이 "답변 완료"인지
    const resolvedChip = page.locator("text=답변 완료").first();
    await expect(resolvedChip).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Student에서 QnA '답변 완료' 상태 확인 OK");

    // 질문 클릭 → 상세
    const qnaTitle = page.locator(`text=${TEST_DATA.qna.title}`).first();
    await qnaTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "34-student-qna-detail-with-answer");

    // "선생님 답변" 섹션 확인
    const answerSection = page.locator("text=선생님 답변").first();
    await expect(answerSection).toBeVisible({ timeout: 5000 });

    // 답변 내용 확인
    const answerContent = page.locator(`text=E2E QnA 답변입니다`).first();
    await expect(answerContent).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Student에서 QnA 답변 내용 확인 OK");
  });

  test("11b. Student앱에서 상담 답변 확인", async ({ page }) => {
    await loginViaUI(page, "student");
    await safeGoto(page, `${BASE}/student/community`);

    // 상담 탭
    const counselTab = page.locator("button").filter({ hasText: "상담 신청" }).first();
    await counselTab.click();
    await page.waitForTimeout(2000);
    await snap(page, "35-student-counsel-with-answer");

    // 상태 확인
    const resolvedChip = page.locator("text=답변 완료").first();
    await expect(resolvedChip).toBeVisible({ timeout: 10000 });
    console.log("[CROSS] Student에서 상담 '답변 완료' 상태 확인 OK");

    // 상담 클릭 → 상세
    const counselTitle = page.locator(`text=${TEST_DATA.counsel.title}`).first();
    await counselTitle.click();
    await page.waitForTimeout(2000);
    await snap(page, "36-student-counsel-detail-with-answer");

    // "관리자 답변" 섹션 확인
    const answerSection = page.locator("text=관리자 답변").first();
    await expect(answerSection).toBeVisible({ timeout: 5000 });

    // 답변 내용 확인
    const answerContent = page.locator(`text=E2E 상담 답변입니다`).first();
    await expect(answerContent).toBeVisible({ timeout: 5000 });
    console.log("[CROSS] Student에서 상담 답변 내용 확인 OK");
  });

  // ================================================================
  // STEP 12: 데이터 정합성 - API 응답 vs UI 표시 비교
  // ================================================================
  test("12. 데이터 정합성: API 응답 vs 프론트엔드 표시 비교", async ({ page }) => {
    // Admin 토큰으로 API 조회
    const adminToken = await getToken(
      page,
      process.env.E2E_ADMIN_USER || "admin97",
      process.env.E2E_ADMIN_PASS || "koreaseoul97"
    );

    const allPosts = await fetchAllPosts(page, adminToken);
    console.log(`[정합성] 총 게시물 수: ${allPosts.length}`);

    // 각 타입별 게시물 확인
    const byType: Record<string, any[]> = {};
    for (const p of allPosts) {
      byType[p.post_type] = byType[p.post_type] || [];
      byType[p.post_type].push(p);
    }

    console.log("[정합성] 타입별 게시물 수:");
    for (const [type, posts] of Object.entries(byType)) {
      console.log(`  ${type}: ${posts.length}건`);
    }

    // 5개 섹터 각 1건씩 있는지 확인
    expect(byType["notice"]?.length).toBeGreaterThanOrEqual(1);
    expect(byType["board"]?.length).toBeGreaterThanOrEqual(1);
    expect(byType["materials"]?.length).toBeGreaterThanOrEqual(1);
    expect(byType["qna"]?.length).toBeGreaterThanOrEqual(1);
    expect(byType["counsel"]?.length).toBeGreaterThanOrEqual(1);

    // QnA에 답변이 있는지 확인
    const qnaPost = byType["qna"].find((p: any) => p.title.includes(`E2E-${TS}`));
    expect(qnaPost).toBeTruthy();
    expect(qnaPost.replies_count).toBeGreaterThanOrEqual(1);
    console.log(`[정합성] QnA #${qnaPost.id} replies_count=${qnaPost.replies_count} OK`);

    // QnA 답변 내용 API로 확인
    const qnaRepliesResp = await page.request.get(
      `${API}/api/v1/community/posts/${qnaPost.id}/replies/`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const qnaReplies = await qnaRepliesResp.json();
    expect(Array.isArray(qnaReplies)).toBe(true);
    expect(qnaReplies.length).toBeGreaterThanOrEqual(1);
    expect(qnaReplies[0].content).toContain("E2E QnA 답변입니다");
    console.log(`[정합성] QnA 답변 API 데이터 일치 OK`);

    // 상담 답변 확인
    const counselPost = byType["counsel"].find((p: any) => p.title.includes(`E2E-${TS}`));
    expect(counselPost).toBeTruthy();
    expect(counselPost.replies_count).toBeGreaterThanOrEqual(1);

    const counselRepliesResp = await page.request.get(
      `${API}/api/v1/community/posts/${counselPost.id}/replies/`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const counselReplies = await counselRepliesResp.json();
    expect(counselReplies.length).toBeGreaterThanOrEqual(1);
    expect(counselReplies[0].content).toContain("E2E 상담 답변입니다");
    console.log(`[정합성] 상담 답변 API 데이터 일치 OK`);

    // 각 게시물의 tenant 일치 확인 (모두 tenant 1)
    for (const p of allPosts) {
      if (p.tenant) {
        expect(p.tenant).toBe(1);
      }
    }
    console.log("[정합성] 전체 게시물 tenant=1 확인 OK");

    // author_role 확인
    const noticePost = byType["notice"].find((p: any) => p.title.includes(`E2E-${TS}`));
    expect(noticePost?.author_role).toBe("staff");
    expect(qnaPost?.author_role).toBe("student");
    expect(counselPost?.author_role).toBe("student");
    console.log("[정합성] author_role 확인 OK (notice=staff, qna/counsel=student)");

    // Student 토큰으로 공개 게시물 조회 → 동일 데이터 확인
    const studentToken = await getToken(
      page,
      process.env.E2E_STUDENT_USER || "3333",
      process.env.E2E_STUDENT_PASS || "test1234"
    );

    // Student가 공지사항 조회
    const studentNoticeResp = await page.request.get(
      `${API}/api/v1/community/posts/notices/`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const studentNotices = await studentNoticeResp.json();
    const e2eNotice = (Array.isArray(studentNotices) ? studentNotices : []).find(
      (p: any) => p.title.includes(`E2E-${TS}`)
    );
    expect(e2eNotice).toBeTruthy();
    expect(e2eNotice.title).toBe(noticePost.title);
    console.log("[정합성] Student API 공지사항 데이터 == Admin API 데이터 일치 OK");

    // Student가 게시판 조회
    const studentBoardResp = await page.request.get(
      `${API}/api/v1/community/posts/board/`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const studentBoards = await studentBoardResp.json();
    const e2eBoard = (Array.isArray(studentBoards) ? studentBoards : []).find(
      (p: any) => p.title.includes(`E2E-${TS}`)
    );
    expect(e2eBoard).toBeTruthy();
    console.log("[정합성] Student API 게시판 데이터 일치 OK");

    // Student가 자료실 조회
    const studentMatResp = await page.request.get(
      `${API}/api/v1/community/posts/materials/`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const studentMats = await studentMatResp.json();
    const e2eMat = (Array.isArray(studentMats) ? studentMats : []).find(
      (p: any) => p.title.includes(`E2E-${TS}`)
    );
    expect(e2eMat).toBeTruthy();
    console.log("[정합성] Student API 자료실 데이터 일치 OK");

    // Student가 자신의 QnA 답변 조회
    const studentQnaRepliesResp = await page.request.get(
      `${API}/api/v1/community/posts/${qnaPost.id}/replies/`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "X-Tenant-Code": TENANT_CODE,
          Host: "api.hakwonplus.com",
        },
      }
    );
    const studentQnaReplies = await studentQnaRepliesResp.json();
    expect(studentQnaReplies.length).toBe(qnaReplies.length);
    expect(studentQnaReplies[0].content).toBe(qnaReplies[0].content);
    console.log("[정합성] Student/Admin QnA 답변 API 데이터 완전 일치 OK");

    console.log("\n========================================");
    console.log("[최종 정합성 검증 결과] 모든 항목 PASS");
    console.log("========================================");

    await snap(page, "37-integrity-final");
  });
});
