import { test, expect } from "../fixtures/strictTest";
// 의도적 dual import: 아래 "비밀번호 찾기 에러 검증" describe 는 존재하지 않는
// 학생 정보로 API 404 를 발생시키는 음성 시나리오라 console.error 가 당연히 발생.
// strictTest 의 zero-defect guard 를 우회하기 위해 baseTest/baseExpect 를 별도 사용.
import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("비밀번호 찾기 모달 UI 검증", () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지 진입
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(1000);
  });

  test("로그인 폼 확장 → 비밀번호 찾기 링크가 표시된다", async ({ page }) => {
    // 로그인 버튼 클릭하여 폼 확장
    const expandBtn = page.getByTestId("login-expand-btn");
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // 비밀번호 찾기 링크 확인
    const pwResetLink = page.getByRole("button", { name: "비밀번호 찾기" });
    await expect(pwResetLink).toBeVisible();
  });

  test("비밀번호 찾기 모달이 정상 오픈되고 학생/학부모 탭이 동작한다", async ({ page }) => {
    // 폼 확장
    await page.getByTestId("login-expand-btn").click();

    // 모달 열기
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    // 모달 확인
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("비밀번호 찾기")).toBeVisible();
    await expect(dialog.getByText("임시 비밀번호를 알림톡으로 보내드립니다")).toBeVisible();

    // 학생 탭 기본 선택 확인
    const studentBtn = dialog.getByRole("button", { name: "학생" });
    const parentBtn = dialog.getByRole("button", { name: "학부모" });
    await expect(studentBtn).toHaveAttribute("aria-pressed", "true");
    await expect(parentBtn).toHaveAttribute("aria-pressed", "false");

    // 학생 탭: 학생 이름 + 전화번호 입력 필드
    await expect(dialog.getByPlaceholder("학생 이름 *")).toBeVisible();
    await expect(dialog.getByText("학생 또는 학부모 전화번호 *")).toBeVisible();

    // 학부모 탭 전환
    await parentBtn.click();
    await expect(parentBtn).toHaveAttribute("aria-pressed", "true");
    await expect(studentBtn).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByText("학부모 전화번호 *")).toBeVisible();
  });

  test("이름 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
    await page.getByTestId("login-expand-btn").click();
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 이름 비워두고 제출
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();
    await expect(dialog.getByText("학생 이름을 입력해 주세요")).toBeVisible();
  });

  test("전화번호 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
    await page.getByTestId("login-expand-btn").click();
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 이름만 입력, 전화번호 비움
    await dialog.getByPlaceholder("학생 이름 *").fill("테스트학생");
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();
    await expect(dialog.getByText("전화번호를 010 뒤 8자리로 입력해 주세요")).toBeVisible();
  });

  test("ESC 키로 모달이 닫힌다", async ({ page }) => {
    await page.getByTestId("login-expand-btn").click();
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("취소 버튼으로 모달이 닫힌다", async ({ page }) => {
    await page.getByTestId("login-expand-btn").click();
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).not.toBeVisible();
  });
});

// 의도적 404 요청 → 브라우저 콘솔 에러 불가피 → strictTest 대신 baseTest 사용
baseTest.describe("비밀번호 찾기 에러 검증", () => {
  baseTest.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(1000);
  });

  baseTest("존재하지 않는 학생 정보 입력 시 서버 에러 메시지가 표시된다", async ({ page }) => {
    baseTest.setTimeout(30_000);

    await page.getByTestId("login-expand-btn").click();
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();

    const dialog = page.getByRole("dialog");
    await baseExpect(dialog).toBeVisible();

    // 존재하지 않는 학생 정보 입력
    await dialog.getByPlaceholder("학생 이름 *").fill("존재하지않는학생");

    // PhoneInput010Blocks에 번호 입력 — 010 고정 + 뒤 8자리 2블록
    const phoneInputs = dialog.locator("input[inputmode='numeric']");
    await phoneInputs.nth(0).fill("1234");
    await phoneInputs.nth(1).fill("5678");

    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

    // 서버에서 404 응답 → 백엔드 detail 에러 메시지
    await baseExpect(dialog.getByText(/등록된 학생이 없습니다/)).toBeVisible({ timeout: 10000 });
  });
});
