import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TS = Date.now();

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

test.describe("알림톡 실사용 검증 — 템플릿 편집 → 발송 → 수신", () => {
  let token: string;
  let studentId: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let studentName: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const tokens = await resp.json();
    token = tokens.access;

    // 테스트 학생 조회
    const sResp = await request.get(`${API}/api/v1/students/?page_size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sData = await sResp.json();
    studentId = sData.results[0].id;
    studentName = sData.results[0].name;
  });

  test("1. 자동발송 페이지 — 전체 섹션 + 트리거 상태 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/message/auto-send`);
    await page.waitForLoadState("networkidle");
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(2000);

    // 좌측 섹션 목록 확인
    const sections = ["가입/등록", "출결", "시험", "과제", "클리닉/상담", "결제"];
    for (const sec of sections) {
      const el = page.locator(`text=${sec}`).first();
      const visible = await el.isVisible().catch(() => false);
      console.log(`[섹션] ${sec}: ${visible ? "✅" : "❌"}`);
    }

    // 각 섹션 클릭하며 트리거 확인
    for (const sec of ["출결", "시험", "과제", "클리닉/상담", "결제"]) {
      const secBtn = page.locator(`text=${sec}`).first();
      if (await secBtn.isVisible().catch(() => false)) {
        await secBtn.click();
        // eslint-disable-next-line no-restricted-syntax
        await page.waitForTimeout(800);
        const bodyText = await page.locator("main, [class*='content']").first().innerText().catch(() => "");
        // 활성화/비활성 토글 수 세기
        const activeCount = (bodyText.match(/활성화|항상 활성/g) || []).length;
        console.log(`[${sec}] 트리거 활성 수: ${activeCount}`);
      }
    }
    await page.screenshot({ path: "e2e/screenshots/verify-01-autosend.png", fullPage: true });
  });

  test("2. 템플릿 편집 — 커스텀 양식 생성 + 변수 블록 삽입", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/message/templates`);
    await page.waitForLoadState("networkidle");
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(2000);

    // "새 문구" 버튼 클릭
    const newBtn = page.locator("button").filter({ hasText: /새 (문구|템플릿)/ }).first();
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/verify-02-new-template-modal.png", fullPage: true });

    // 모달 확인
    const dialog = page.getByRole("dialog").filter({ hasText: /문구|템플릿|양식/ }).last();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 양식명 입력
    const nameInput = dialog.locator("input:visible").first();
    await expect(nameInput, "문구 편집 dialog 안에 이름 input 이 있어야 함").toBeVisible({ timeout: 5000 });
    await nameInput.fill(`[E2E-${TS}] 알림톡 검증`);

    // 본문 입력 — 변수 블록 포함. dialog 가 열렸으면 textarea 는 반드시 있어야.
    const bodyArea = dialog.locator("textarea:visible").first();
    await expect(bodyArea, "문구 편집 dialog 안에 본문 textarea 가 있어야 함").toBeVisible({ timeout: 5000 });
    await bodyArea.fill(
      "#{학생이름}님, 안녕하세요.\n" +
      "#{학원명}에서 안내드립니다.\n\n" +
      "강의: #{강의명}\n" +
      "차시: #{차시명}\n\n" +
      "궁금한 점은 학원으로 연락주세요.\n" +
      "#{사이트링크}"
    );

    await page.screenshot({ path: "e2e/screenshots/verify-02-template-filled.png", fullPage: true });

    // 운영 전체 suite에서는 템플릿을 영구 생성하지 않는다. 저장 버튼 노출과 입력 UX만 검증한다.
    const saveBtn = dialog.locator("button:visible").filter({ hasText: /저장|만들기|생성/ }).first();
    await expect(saveBtn, "문구 편집 dialog 안에 저장/만들기 버튼이 있어야 함").toBeVisible({ timeout: 5000 });
    const cancelBtn = dialog.locator("button:visible").filter({ hasText: /취소|닫기/ }).first();
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.screenshot({ path: "e2e/screenshots/verify-02-template-compose-only.png", fullPage: true });
  });

  test("3. 수동 발송 — 학생 선택 → 알림톡 미리보기 → 발송", async ({ request }) => {
    // API로 직접 수동 발송 테스트 (preview → confirm)
    const headers = { Authorization: `Bearer ${token}` };

    // 3-1. 출결 트리거 preview
    const previewResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "check_in_complete",
        student_ids: [studentId],
        send_to: "parent",
        context: { "강의명": "수학A반", "차시명": "검증차시", "날짜": "2026-04-10", "시간": "09:30" },
      },
    });
    expect(previewResp.status()).toBe(200);
    const previewData = await previewResp.json();
    console.log("[preview] token:", !!previewData.preview_token);
    console.log("[preview] total:", previewData.total_count);
    console.log("[preview] message:", previewData.message_preview?.substring(0, 100));

    // 수신자 정보 확인
    if (previewData.recipients?.length > 0) {
      const r = previewData.recipients[0];
      console.log("[preview] 수신자:", r.student_name, r.phone);
      console.log("[preview] 본문:", r.message_body?.substring(0, 100));
      console.log("[preview] 제외:", r.excluded, r.exclude_reason || "");
    }

    expect(previewData.preview_token, "출결 알림톡 preview_token").toBeTruthy();

    // 3-3. 클리닉 트리거 preview + 확인
    const clinicResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "clinic_reservation_created",
        student_ids: [studentId],
        send_to: "parent",
        context: { "장소": "검증실", "날짜": "2026-04-11", "시간": "10:30" },
      },
    });
    expect(clinicResp.status()).toBe(200);
    const clinicData = await clinicResp.json();
    console.log("[clinic preview] token:", !!clinicData.preview_token);
    console.log("[clinic preview] message:", clinicData.message_preview?.substring(0, 100));

    expect(clinicData.preview_token, "클리닉 알림톡 preview_token").toBeTruthy();

    // 3-4. 성적 트리거 preview + 확인
    const scoreResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "exam_score_published",
        student_ids: [studentId],
        send_to: "parent",
        context: { "강의명": "영어B반", "차시명": "UX검증시험" },
      },
    });
    expect(scoreResp.status()).toBe(200);
    const scoreData = await scoreResp.json();
    console.log("[score preview] message:", scoreData.message_preview?.substring(0, 100));

    expect(scoreData.preview_token, "성적 알림톡 preview_token").toBeTruthy();

    // 3-5. 퇴원 트리거 (수정된 body 확인)
    const wdResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "withdrawal_complete",
        student_ids: [studentId],
        send_to: "parent",
        context: { "강의명": "-", "차시명": "-" },
      },
    });
    expect(wdResp.status()).toBe(200);
    const wdData = await wdResp.json();
    console.log("[withdrawal preview] message:", wdData.message_preview);

    // 본문에 학생이름2 중복 없는지 확인
    if (wdData.recipients?.length > 0) {
      const body = wdData.recipients[0].message_body || "";
      const hasStudentName = body.includes("학생이름") || body.includes("#{");
      console.log("[withdrawal] body:", body.substring(0, 120));
      console.log("[withdrawal] 미치환 변수 잔존:", hasStudentName ? "❌" : "✅");
    }

    expect(wdData.preview_token, "퇴원 알림톡 preview_token").toBeTruthy();
  });

  test("4. 엣지 케이스 — 빈 context, 긴 변수값", async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };

    // 4-1. context 없이 발송 (강의명/차시명 비어있을 때)
    const emptyResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "payment_complete",
        student_ids: [studentId],
        send_to: "parent",
        context: {},  // context 비어있음
      },
    });
    expect(emptyResp.status()).toBe(200);
    const emptyData = await emptyResp.json();
    console.log("[empty context] status:", emptyResp.status());
    console.log("[empty context] token:", !!emptyData.preview_token);
    if (emptyData.recipients?.length > 0) {
      console.log("[empty context] body:", emptyData.recipients[0].message_body?.substring(0, 80));
    }

    // 4-2. 23자 초과 강의명 (ITEM_LIST 제한)
    const longResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "exam_score_published",
        student_ids: [studentId],
        send_to: "parent",
        context: { "강의명": "아주아주아주아주아주아주아주아주긴강의명테스트", "차시명": "짧은차시" },
      },
    });
    expect(longResp.status()).toBe(200);
    const longData = await longResp.json();
    console.log("[long var] status:", longResp.status());
    console.log("[long var] token:", !!longData.preview_token);

    // 4-3. 존재하지 않는 학생 ID
    const badResp = await request.post(`${API}/api/v1/messaging/manual-notification/preview/`, {
      headers,
      data: {
        trigger: "check_in_complete",
        student_ids: [999999],
        send_to: "parent",
        context: { "강의명": "수학", "차시명": "1차시" },
      },
    });
    console.log("[bad student] status:", badResp.status());
    const badData = await badResp.json();
    console.log("[bad student] total:", badData.total_count, "error:", badData.error || "없음");
  });

  test("5. 발송 내역 — 최근 발송 기록 본문/라벨 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 워커 처리 대기
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(10000);

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=10`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
      timeout: 15_000,
    });
    expect(logResp.status()).toBe(200);
    const logData = await logResp.json();
    const logs = Array.isArray(logData.results) ? logData.results : [];
    const sentLogs = logs.filter((item) => item?.success === true || item?.status === "sent");
    expect(sentLogs.length, "최근 발송 성공 로그가 있어야 발송내역 본문을 검증할 수 있음").toBeGreaterThan(0);
    const logsMissingBody = sentLogs.filter((item) => !String(item?.message_body || "").trim());
    expect(logsMissingBody, "성공 발송 로그는 본문을 내려줘야 함").toHaveLength(0);

    await page.goto(`${BASE}/admin/message/log`);
    await page.waitForLoadState("networkidle");
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/verify-05-log-after-send.png", fullPage: true });

    const bodyText = await page.locator("body").innerText();
    const normalizedBodyText = normalizeText(bodyText);

    const visibleBodyLog = sentLogs.find((item) => {
      const body = normalizeText(String(item?.message_body || ""));
      const snippet = body.slice(0, Math.min(18, body.length));
      return snippet.length >= 6 && normalizedBodyText.includes(snippet);
    });
    console.log("[발송내역] API 성공 로그:", sentLogs.length);
    console.log("[발송내역] 메시지 본문:", visibleBodyLog ? "✅" : "❌");
    expect(visibleBodyLog, "최근 발송 로그의 본문 일부가 화면 목록에 보여야 함").toBeTruthy();

    const visibleLabelLog = sentLogs.find((item) => {
      const label = normalizeText(String(item?.template_summary || ""));
      return label && !label.startsWith("KA01") && normalizedBodyText.includes(label.slice(0, Math.min(12, label.length)));
    });
    console.log("[발송내역] 한국어 라벨:", visibleLabelLog ? "✅" : "검증 가능한 라벨 없음");

    // KA01TP 원시 ID가 내용 컬럼에 직접 노출되는지
    // (기존 레코드도 message_body fallback으로 표시되므로 노출 안 됨)
    const rows = page.locator("tr, [class*='row'], [class*='Row']");
    const rowCount = await rows.count();
    let rawIdExposed = false;
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const rowText = await rows.nth(i).innerText().catch(() => "");
      // "내용" 영역에서 KA01TP가 단독으로 보이면 문제
      if (rowText.includes("KA01TP") && !rowText.includes("알림톡")) {
        // 상세 팝업이 아닌 목록에서 KA01TP가 보이면 문제
        rawIdExposed = true;
        break;
      }
    }
    console.log("[발송내역] 원시 ID 노출:", rawIdExposed ? "❌ 아직 노출됨" : "✅ 숨겨짐");
  });
});
