import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

const MOCK_STUDENTS = [
  {
    id: 910001,
    name: "김민준",
    phone: "01011112222",
    parent_phone: "01033334444",
    ps_number: "E2E-910001",
    omr_code: "910001",
    is_managed: true,
    school_type: "HIGH",
    high_school: "테스트고",
    high_school_class: "1",
    grade: 1,
    tags: [],
    enrollments: [],
    created_at: "2026-07-25T00:00:00+09:00",
  },
  {
    id: 910002,
    name: "박서연",
    phone: "01055556666",
    parent_phone: "01077778888",
    ps_number: "E2E-910002",
    omr_code: "910002",
    is_managed: true,
    school_type: "HIGH",
    high_school: "테스트고",
    high_school_class: "2",
    grade: 2,
    tags: [],
    enrollments: [],
    created_at: "2026-07-25T00:00:00+09:00",
  },
];

test("알림톡 발송 직전 카카오 디자인과 학생별 문구를 확인한다", async ({ page }) => {
  await loginViaUI(page, "admin");

  await page.route("**/api/v1/students/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        count: MOCK_STUDENTS.length,
        page_size: 50,
        results: MOCK_STUDENTS,
      }),
    });
  });
  await page.route("**/api/v1/messaging/templates/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/v1/messaging/send/preflight/**", async (route) => {
    const requestBody = route.request().postDataJSON() as { send_to?: "student" | "parent" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        can_send: true,
        mode: "now",
        send_to: requestBody.send_to || "parent",
        recipient: {
          selected: 2,
          resolved: 2,
          valid_phone: 2,
          skipped_no_phone: 0,
          duplicate_phone: 0,
          unique_phone: 2,
          invalid_or_deleted: 0,
          limit: 500,
        },
        template: {
          ok: true,
          source: "unified",
          name: "출석 안내 기본형",
          solapi_template_id: "E2E_TEMPLATE",
          solapi_status: "APPROVED",
          detail: "",
          uses_unified_template: true,
          template_type: "attendance",
        },
        preview_recipients: MOCK_STUDENTS.map((student) => ({
          student_id: student.id,
          student_name: student.name,
          phone: requestBody.send_to === "student" ? "010****" + student.phone.slice(-4) : "010****" + student.parent_phone.slice(-4),
          excluded: false,
          exclude_reason: "",
          full_message_body:
            `예담학원입니다.\n\n${student.name}학생님.\n\n출석 안내 드립니다.\n` +
            "강의\n-\n\n차시\n-\n\n날짜\n-\n\n시간\n-\n\n테스트 안내입니다.\nhttps://yedam.example.com",
        })),
        limits: {
          hourly_limit: 500,
          sent_last_hour: 0,
          remaining_this_hour: 500,
        },
        blockers: [],
        warnings: [],
      }),
    });
  });

  await gotoAndSettle(page, `${BASE}/workspace/students`, { settleMs: 500 });

  await expect(page.getByText("김민준", { exact: true })).toBeVisible();
  await expect(page.getByText("박서연", { exact: true })).toBeVisible();
  await page.getByLabel("전체 선택").check();
  await page.getByRole("button", { name: "메시지 발송" }).click();

  const sendButton = page.locator(".send-modal__send-btn");
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  const kakaoPreview = page.getByLabel("카카오톡 실제 발송 미리보기");
  await expect(kakaoPreview).toBeVisible();
  await expect(page.getByRole("dialog", { name: "보내기 전 마지막 확인" })).toBeVisible();
  await expect(kakaoPreview).toContainText("예담학원입니다.");
  await expect(kakaoPreview).toContainText("김민준학생님");
  await expect(kakaoPreview).not.toContainText("수학 심화반");
  await expect(kakaoPreview).not.toContainText("2026-04-06");
  await expect(page.getByText("지금 보는 학생", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "전체 학생 열기" }).click();
  const studentChoices = page.getByRole("radiogroup", { name: "미리보기 학생 선택" });
  await expect(studentChoices.getByRole("radio")).toHaveCount(2);
  await studentChoices.getByRole("radio").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(studentChoices.getByRole("radio").filter({ hasText: "박서연" })).toHaveAttribute("aria-checked", "true");
  await expect(kakaoPreview).toContainText("박서연학생님");
  await expect(page.locator(".send-modal__confirm-previewing")).toContainText("박서연");
  await page.screenshot({ path: "e2e/screenshots/alimtalk-final-preview-desktop.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(kakaoPreview).toBeVisible();
  await expect(page.getByRole("button", { name: "발송하기" })).toBeVisible();
  const recipientPanelBox = await page.locator(".send-modal__confirm-recipients").boundingBox();
  const confirmActionsBox = await page.locator(".send-modal__confirm-actions").boundingBox();
  expect(recipientPanelBox).not.toBeNull();
  expect(confirmActionsBox).not.toBeNull();
  expect(confirmActionsBox!.y).toBeGreaterThanOrEqual(
    recipientPanelBox!.y + recipientPanelBox!.height - 1,
  );
  await page.screenshot({ path: "e2e/screenshots/alimtalk-final-preview-mobile.png", fullPage: false });

  await page.getByRole("button", { name: "돌아가기" }).click();
  await expect(page.getByRole("button", { name: "발송하기" })).toBeHidden();
});
