// E2E: 클리닉 대상자 출력물 — 미제출/진행중 파싱 검증
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");

const TEST_DATA = [
  "단대",
  "2026 1학기 중간 단대부고",
  "날짜",
  "03/21",
  "국태민\t현장\t60점\t진행중\t-\t-\t-\t-\t-\t-\t-\t-",
  "김규민\t현장\t100점\t완료\t39점\t완료\t100%\t완료\t100%\t완료\t100%\t완료",
  "김주헌\t현장\t80점\t완료\t-\t-\t50%\t진행중\t0%\t진행중\t0%\t진행중",
  "민제경\t현장\t60점\t진행중\t7점\t진행중\t0%\t진행중\t100%\t완료\t0%\t진행중",
  "서형인\t현장\t85점\t완료\t-\t-\t-\t진행중\t-\t진행중\t-\t진행중",
  "임승준\t영상\t95점\t완료\t-\t완료\t-\t진행중\t-\t진행중\t-\t진행중",
  "조은준\t영상\t-\t진행중\t-\t진행중\t-\t진행중\t-\t진행중\t-\t진행중",
  "최태준\t현장\t5점\t진행중\t-\t-\t-\t-\t-\t-\t-\t-",
].join("\n");

test.describe("클리닉 출력물 도구", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("복붙 파싱: 진행중/미제출 학생 올바르게 분류", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/clinic`, { waitUntil: "networkidle" });
    await expect(page.locator("text=데이터 붙여넣기")).toBeVisible({ timeout: 10000 });

    const ta = page.locator("textarea#clinic-paste-ta");
    await expect(ta).toBeVisible();

    // 클립보드 paste 시뮬레이션 (onPaste가 자동으로 파싱 트리거)
    await ta.focus();
    await page.evaluate(async (data) => {
      const ta = document.getElementById("clinic-paste-ta") as HTMLTextAreaElement;
      // React state 업데이트를 위한 native setter
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
      )!.set!;
      nativeSetter.call(ta, data);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      // paste 이벤트도 트리거
      const dt = new DataTransfer();
      dt.setData("text/plain", data);
      ta.dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: dt, bubbles: true, cancelable: true,
      }));
    }, TEST_DATA);

    // onPaste → handlePaste가 setTimeout(0)을 사용하므로 충분히 대기
    await page.waitForTimeout(3000);

    // iframe에서 결과 확인
    const iframe = page.frameLocator("#cprev");

    // 시험+과제 미통과에 민제경 있어야 함
    await expect(iframe.locator('[data-field="both"]')).toContainText("민제경", { timeout: 8000 });

    // 시험 미통과에 국태민, 최태준
    await expect(iframe.locator('[data-field="examOnly"]')).toContainText("국태민");
    await expect(iframe.locator('[data-field="examOnly"]')).toContainText("최태준");

    // 과제 미통과에 김주헌, 서형인 (대시+진행중 → 컬럼타입 추론으로 hw 판별)
    await expect(iframe.locator('[data-field="hwOnly"]')).toContainText("김주헌");
    await expect(iframe.locator('[data-field="hwOnly"]')).toContainText("서형인");

    // 영상 학생(임승준, 조은준)은 출력물에서 제외
    await expect(iframe.locator('[data-field="both"]')).not.toContainText("조은준");
    await expect(iframe.locator('[data-field="hwOnly"]')).not.toContainText("임승준");
    await expect(iframe.locator('[data-field="examOnly"]')).not.toContainText("조은준");
    await expect(iframe.locator('[data-field="examOnly"]')).not.toContainText("임승준");

    // 전부 완료인 학생(김규민)은 제외
    const allNameLists = iframe.locator(".name-list");
    const count = await allNameLists.count();
    for (let i = 0; i < count; i++) {
      await expect(allNameLists.nth(i)).not.toContainText("김규민");
    }

    // 메타데이터
    await expect(iframe.locator('[data-field="sessionTitle"]')).toContainText("2026 1학기 중간 단대부고");

    await page.screenshot({ path: "e2e/screenshots/clinic-printout-final.png", fullPage: true });
  });
});
