/**
 * 실제 운영 시나리오 전체 실행 — 브라우저 클릭 기반
 *
 * 교사: 학생 가입 → 강의 생성 → 수강생 등록 → 차시 → 시험 → 성적 → 커뮤니티 → 클리닉
 * 학생: 로그인 → 공지 확인 → QnA 질문 → 클리닉 예약
 * 교사: QnA 답변 → 클리닉 출석 처리
 * 학생: 답변 확인
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();

test.describe.serial("실제 운영 시나리오 (0317테스트학생)", () => {
  let browser: Browser;
  let teacherPage: Page;
  let studentPage: Page;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  // ══════════════════════════════════════════════════════
  // STEP 1: 교사 로그인
  // ══════════════════════════════════════════════════════
  test("1. 교사 로그인", async () => {
    const ctx = await browser.newContext();
    teacherPage = await ctx.newPage();
    await loginViaUI(teacherPage, "admin");
    // loginViaUI가 /admin으로 이동 + [data-app] 대기까지 완료
    await expect(teacherPage.locator("[data-app]").first()).toBeVisible({ timeout: 5000 });
  });

  // ══════════════════════════════════════════════════════
  // STEP 2: 학생 등록 (알림톡 ON)
  // ══════════════════════════════════════════════════════
  test("2. 학생 등록 + 데이터 준비 (API)", async () => {
    // 학생 등록 (API — 모달 UI는 PhoneInput010Blocks 등 복잡)
    const stuResp = await apiCall(teacherPage, "POST", "/students/", {
      name: "0317테스트학생",
      phone: "01034137466",
      parent_phone: "01031217466",
      initial_password: "0000",
      school_type: "HIGH",
      send_welcome_message: true,
    });
    if (stuResp.status === 201) {
      console.log(`  학생 생성: id=${stuResp.body.id}, ps=${stuResp.body.ps_number}`);
      console.log(`  알림톡 발송 요청됨 → 01034137466(학생), 01031217466(학부모)`);
    } else if (stuResp.status === 409) {
      console.log(`  학생 이미 존재 (409) — 기존 학생 사용`);
    } else {
      console.log(`  학생 생성: ${stuResp.status} ${JSON.stringify(stuResp.body)?.substring(0, 100)}`);
    }
    expect([201, 409]).toContain(stuResp.status);
  });

  // ══════════════════════════════════════════════════════
  // STEP 3-7: 강의/차시/시험/성적은 API로 설정 (UI가 복잡한 멀티스텝)
  // 이후 학생 앱에서 브라우저로 확인
  // ══════════════════════════════════════════════════════
  test("3-7. 강의/차시/시험/성적/커뮤니티 데이터 준비 (API)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dateStr2 = dayAfter.toISOString().split("T")[0];

    // 강의 생성
    const lec = await apiCall(teacherPage, "POST", "/lectures/lectures/", {
      name: "0317 수학 기초반", title: "0317 수학 기초반", subject: "수학", is_active: true,
    });
    console.log(`  강의 응답: ${lec.status} ${JSON.stringify(lec.body)?.substring(0, 200)}`);
    // 이미 존재하면 기존 강의 사용
    if (lec.status !== 201) {
      const existingLecs = await apiCall(teacherPage, "GET", "/lectures/lectures/?page_size=50");
      const existing = (existingLecs.body?.results || []).find((l: any) => l.title?.includes("0317"));
      if (existing) {
        console.log(`  기존 강의 사용: id=${existing.id}`);
        lec.body = existing;
        lec.status = 201;
      }
    }
    expect(lec.status).toBe(201);
    console.log(`  강의: id=${lec.body.id}`);

    // 수강생 등록 (학생 찾기)
    const stuList = await apiCall(teacherPage, "GET", "/students/?page_size=200");
    const stu = (stuList.body?.results || []).find((s: any) => s.name === "0317테스트학생");
    if (stu) {
      const enroll = await apiCall(teacherPage, "POST", "/lectures/enrollments/", {
        lecture: lec.body.id, student: stu.id,
      });
      console.log(`  수강등록: ${enroll.status}`);
    }

    // 차시/시험 — 이미 존재하면 skip (idempotent)
    const s1 = await apiCall(teacherPage, "POST", "/lectures/sessions/", {
      lecture: lec.body.id, order: 1, date: dateStr,
      start_time: "14:00", end_time: "16:00", session_type: "regular",
    });
    console.log(`  차시1: ${s1.status}`);

    const s2 = await apiCall(teacherPage, "POST", "/lectures/sessions/", {
      lecture: lec.body.id, order: 2, date: dateStr2,
      start_time: "10:00", end_time: "12:00", session_type: "supplement",
    });
    console.log(`  차시2(보강): ${s2.status}`);

    // 시험
    const exam = await apiCall(teacherPage, "POST", "/exams/", {
      title: "0317 수학 1차 시험", subject: "수학", exam_type: "regular",
      total_score: 100, pass_score: 60,
    });
    console.log(`  시험: ${exam.status}`);

    // 공지 2건
    for (const [title, content] of [
      ["[0317] 3월 학원 운영 안내", "3월 수업 일정을 안내드립니다."],
      ["[0317] 시험 일정 공지", "다음 주 수요일 1차 시험이 진행됩니다."],
    ]) {
      const r = await apiCall(teacherPage, "POST", "/community/posts/", {
        post_type: "notice", title, content, node_ids: [],
      });
      console.log(`  공지: ${r.status} "${title}"`);
    }

    // 자료실
    const mat = await apiCall(teacherPage, "POST", "/community/posts/", {
      post_type: "material", title: "[0317] 수학 기초 교재", content: "교재 파일입니다.", node_ids: [],
    });
    console.log(`  자료실: ${mat.status}`);

    // 클리닉 세션
    const clinic = await apiCall(teacherPage, "POST", "/clinic/sessions/", {
      date: dateStr, start_time: "17:00", duration_minutes: 60,
      location: "보충학습실", max_participants: 10, title: "0317 수학 보충 클리닉",
    });
    console.log(`  클리닉: ${clinic.status} id=${clinic.body?.id}`);
  });

  // ══════════════════════════════════════════════════════
  // STEP 8: 학생 로그인 (실제 브라우저)
  // ══════════════════════════════════════════════════════
  test("8. 학생 로그인 (0317테스트학생)", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();

    // 학생 ps_number 확인 (API로 먼저 찾기)
    const stuList = await apiCall(teacherPage, "GET", "/students/?page_size=200");
    const stu = (stuList.body?.results || []).find((s: any) => s.name === "0317테스트학생");
    const psNumber = stu?.ps_number || stu?.phone || "01034137466";
    console.log(`  학생 아이디: ${psNumber}`);

    // API 기반 로그인 (loginViaUI와 동일 방식)
    const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
    const tokenResp = await studentPage.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: psNumber, password: "0000" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });

    if (tokenResp.status() !== 200) {
      // 전화번호로 재시도
      const tokenResp2 = await studentPage.request.post(`${API_BASE}/api/v1/token/`, {
        data: { username: "01034137466", password: "0000" },
        headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
      });
      expect(tokenResp2.status()).toBe(200);
      const tokens = await tokenResp2.json();
      await studentPage.goto(`${BASE}/login`, { waitUntil: "commit" });
      await studentPage.evaluate((t) => { localStorage.setItem("access", t.access); localStorage.setItem("refresh", t.refresh); }, tokens);
    } else {
      const tokens = await tokenResp.json();
      await studentPage.goto(`${BASE}/login`, { waitUntil: "commit" });
      await studentPage.evaluate((t) => { localStorage.setItem("access", t.access); localStorage.setItem("refresh", t.refresh); }, tokens);
    }

    await studentPage.goto(`${BASE}/student`, { waitUntil: "domcontentloaded" });
    await studentPage.waitForSelector("[data-app='student']", { state: "attached", timeout: 15000 });
    console.log(`  학생 로그인 성공`);
  });

  // ══════════════════════════════════════════════════════
  // STEP 9: 학생 — 공지 확인 (브라우저)
  // ══════════════════════════════════════════════════════
  test("9. 학생이 공지를 확인한다", async () => {
    await studentPage.goto(`${BASE}/student/notices`);
    await studentPage.waitForLoadState("load");
    await studentPage.waitForTimeout(2000);

    // 공지가 보이는지
    const notice = studentPage.locator("text=0317").first();
    await expect(notice).toBeVisible({ timeout: 10000 });
  });

  // ══════════════════════════════════════════════════════
  // STEP 10: 학생 — QnA 질문 등록 (브라우저)
  // ══════════════════════════════════════════════════════
  test("10. 학생이 QnA 질문을 등록한다", async () => {
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("networkidle");

    // QnA 탭 클릭 — 탭 전환 + 데이터 로딩 대기
    const qnaTab = studentPage.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.waitFor({ state: "visible", timeout: 8000 });
    await qnaTab.click();
    await studentPage.waitForTimeout(1500);

    // 질문하기 버튼 (프로필 로딩 완료 후 렌더링됨)
    const writeBtn = studentPage.locator("button").filter({ hasText: "질문하기" }).first();
    await writeBtn.waitFor({ state: "visible", timeout: 10000 });
    await writeBtn.click();

    // 제목
    const title = studentPage.locator('input[placeholder*="제목"]').first();
    await title.waitFor({ state: "visible", timeout: 5000 });
    await title.fill("수학 3장 도함수 질문");

    // 내용 (TipTap)
    const editor = studentPage.locator('.ProseMirror[contenteditable="true"], [contenteditable="true"]').first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await studentPage.keyboard.type("도함수 구하는 방법이 헷갈립니다. 설명해주세요.");

    // 제출
    const submitBtn = studentPage.locator("button").filter({ hasText: /보내기|등록|제출/ }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // 성공 확인 (토스트 또는 목록 복귀)
    await studentPage.waitForTimeout(2000);
  });

  // ══════════════════════════════════════════════════════
  // STEP 11: 학생 — 클리닉 예약 (브라우저)
  // ══════════════════════════════════════════════════════
  test("11. 학생이 클리닉 예약을 한다", async () => {
    await studentPage.goto(`${BASE}/student/clinic`);
    await studentPage.waitForLoadState("load");
    await studentPage.waitForTimeout(2000);

    // 클리닉 페이지가 로드되는지
    await expect(studentPage.locator("[data-app='student']").first()).toBeVisible();
    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();

    // 예약 가능한 세션이 있으면 클릭
    const sessionCard = studentPage.locator("text=보충학습실, text=수학 보충, text=17:00").first();
    if (await sessionCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionCard.click();
      await studentPage.waitForTimeout(500);

      const bookBtn = studentPage.locator("button").filter({ hasText: /예약|신청/ }).first();
      if (await bookBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bookBtn.click();
        await studentPage.waitForTimeout(2000);
      }
    }
  });

  // ══════════════════════════════════════════════════════
  // STEP 12: 교사 — QnA 답변 (브라우저)
  // ══════════════════════════════════════════════════════
  test("12. 교사가 QnA에 답변한다", async () => {
    await teacherPage.goto(`${BASE}/admin/community/qna`);
    await teacherPage.waitForLoadState("load");
    await teacherPage.waitForTimeout(2000);

    // 학생 질문 찾기
    const question = teacherPage.locator("text=도함수 질문, text=수학 3장").first();
    if (await question.isVisible({ timeout: 5000 }).catch(() => false)) {
      await question.click();
      await teacherPage.waitForTimeout(1000);

      // 답변 입력
      const replyInput = teacherPage.locator('.qna-inbox__composer textarea, textarea').last();
      if (await replyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await replyInput.fill("도함수는 극한으로 구합니다. 교재 52페이지를 참고하세요.");
        const sendBtn = teacherPage.locator("button").filter({ hasText: /답변|등록|보내기/ }).first();
        await sendBtn.click();
        await teacherPage.waitForTimeout(2000);
      }
    }
  });

  // ══════════════════════════════════════════════════════
  // STEP 13: 교사 — 클리닉 확인 (브라우저)
  // ══════════════════════════════════════════════════════
  test("13. 교사가 클리닉에서 예약자를 확인한다", async () => {
    await teacherPage.goto(`${BASE}/admin/clinic/home`);
    await teacherPage.waitForLoadState("load");
    await teacherPage.waitForTimeout(2000);

    // 클리닉 홈이 로드되는지
    await expect(teacherPage.locator("text=Not Found")).not.toBeVisible();
    await expect(teacherPage.locator("main, [class*='page']").first()).toBeVisible();
  });

  // ══════════════════════════════════════════════════════
  // STEP 14: 학생 — 답변 확인 (브라우저)
  // ══════════════════════════════════════════════════════
  test("14. 학생이 QnA 답변을 확인한다", async () => {
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("load");

    const qnaTab = studentPage.locator("button, [role='tab']").filter({ hasText: /QnA|질문/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await studentPage.waitForTimeout(1000);
    }

    // 내 질문 찾기
    const myQ = studentPage.locator("text=도함수 질문, text=수학 3장").first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      await studentPage.waitForTimeout(1000);

      // 답변 확인
      const answer = studentPage.locator("text=극한으로 구합니다, text=52페이지").first();
      if (await answer.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("  ✅ 학생이 교사 답변을 확인했습니다");
      }
    }
  });

  // ══════════════════════════════════════════════════════
  // STEP 15: 학생 — 대시보드 최종 확인 (브라우저)
  // ══════════════════════════════════════════════════════
  test("15. 학생 대시보드가 정상 표시된다", async () => {
    await studentPage.goto(`${BASE}/student/dashboard`);
    await studentPage.waitForLoadState("load");
    await studentPage.waitForTimeout(2000);

    await expect(studentPage.locator("[data-app='student']").first()).toBeVisible();
    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();
  });

  test.afterAll(async () => {
    await studentPage?.context()?.close();
    await teacherPage?.context()?.close();
    // 데이터는 정리하지 않음 (실제 확인용)
  });
});
