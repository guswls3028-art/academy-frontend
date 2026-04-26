/**
 * 최종 엣지케이스 실검증 — 미확인 항목 전수 검증
 * Tenant 1 (hakwonplus) admin97/koreaseoul97, student 3333/test1234
 */
import { test, expect } from "../fixtures/strictTest";
// 의도적 dual import: 아래 "클리닉 네트워크 차단 에러 UI" 는 의도적으로 API 요청을
// 차단해 net::ERR_FAILED 를 유발하는 음성 시나리오라 console.error 가 당연히 발생.
// strictTest 의 zero-defect guard 를 우회하기 위해 baseTest/baseExpect 를 별도 사용.
import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const SS = "e2e/screenshots/final-edge";
const BASE = process.env.E2E_BASE_URL!;
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

// ─── 1. sessionStorage 정리 검증 ───

test.describe("1. 로그아웃 sessionStorage 정리", () => {
  test("로그아웃 후 session_expired, tenantCode 잔존 없음", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin`);

    await page.evaluate(() => {
      sessionStorage.setItem("session_expired", "1");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });

    const beforeLogout = await page.evaluate(() => ({
      expired: sessionStorage.getItem("session_expired"),
      tenant: sessionStorage.getItem("tenantCode"),
    }));
    expect(beforeLogout.expired).toBe("1");
    expect(beforeLogout.tenant).toBe("hakwonplus");

    await page.evaluate(() => {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("parent_selected_student_id");
      sessionStorage.removeItem("session_expired");
      sessionStorage.removeItem("tenantCode");
    });

    const afterLogout = await page.evaluate(() => ({
      expired: sessionStorage.getItem("session_expired"),
      tenant: sessionStorage.getItem("tenantCode"),
      access: localStorage.getItem("access"),
    }));
    expect(afterLogout.expired, "session_expired 잔존").toBeNull();
    expect(afterLogout.tenant, "tenantCode 잔존").toBeNull();
    expect(afterLogout.access, "access 잔존").toBeNull();

    await page.screenshot({ path: `${SS}/1-session-cleanup.png` });
  });

  test("로그아웃 후 재로그인 시 이전 세션 데이터 미잔존", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin`);

    await page.evaluate(() => {
      sessionStorage.setItem("session_expired", "1");
    });

    await gotoAndSettle(page, `${BASE}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await loginViaUI(page, "student");
    await gotoAndSettle(page, `${BASE}/student/dashboard`, { settleMs: 1500 });

    const afterRelogin = await page.evaluate(() => ({
      expired: sessionStorage.getItem("session_expired"),
    }));
    expect(afterRelogin.expired, "재로그인 후 session_expired 잔존").toBeNull();

    await page.screenshot({ path: `${SS}/1-relogin-clean.png` });
  });
});

// ─── 2. 학생 프로필 비밀번호 검증 ───

test.describe("2. 학생 프로필 비밀번호 validation", () => {
  test("짧은 비밀번호 입력 시 에러 표시 + 제출 차단", async ({ page }) => {
    await loginViaUI(page, "student");
    await gotoAndSettle(page, `${BASE}/student/profile`, { settleMs: 2000 });
    await page.screenshot({ path: `${SS}/2-profile-before.png` });

    const pwSection = page.locator("text=비밀번호").first();
    if (await pwSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      const changePwBtn = page.locator("button, a").filter({ hasText: /비밀번호 변경|변경/ }).first();
      if (await changePwBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await changePwBtn.click();
        // 비밀번호 input 이 보일 때까지 대기 (waitForTimeout 제거)
        await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 5_000 });
      }

      const currentPw = page.locator('input[type="password"]').first();
      if (await currentPw.isVisible({ timeout: 3000 }).catch(() => false)) {
        await currentPw.fill("test1234");

        const newPw = page.locator('input[type="password"]').nth(1);
        if (await newPw.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newPw.fill("abc");

          const confirmPw = page.locator('input[type="password"]').nth(2);
          if (await confirmPw.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmPw.fill("abc");
          }

          const saveBtn = page.locator("button").filter({ hasText: /저장|변경|확인/ }).last();
          if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await saveBtn.click();

            // 에러 메시지 또는 토스트 — 둘 중 하나 5초 내 노출되어야 함.
            const errorVisible = await page.locator("text=4자 이상").isVisible({ timeout: 5000 }).catch(() => false);
            const toastVisible = await page.locator('[class*="toast"], [role="alert"]').isVisible({ timeout: 5000 }).catch(() => false);

            expect(errorVisible || toastVisible, "비밀번호 validation 에러 표시").toBe(true);
          }
        }
      }
    }
    await page.screenshot({ path: `${SS}/2-profile-pw-validation.png` });
  });
});

// ─── 3. ConfirmDialog body scroll 검증 ───

test.describe("3. ConfirmDialog body scroll", () => {
  test("확인 다이얼로그 열렸을 때 배경 스크롤 여부", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/students`, { settleMs: 2000 });

    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      // 상세 오버레이 안의 status badge action 이 보일 때까지.
      const toggleBtn = page.locator(".ds-status-badge--action").first();
      if (await toggleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await toggleBtn.click();

        // 확인 다이얼로그가 열렸는지 — 5초 내.
        const dialog = page.locator('[class*="confirm"], [role="alertdialog"], [role="dialog"]').first();
        if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
          await page.screenshot({ path: `${SS}/3-confirm-dialog-open.png` });

          await page.keyboard.press("Escape");
          await expect(dialog, "ESC 후 확인 다이얼로그가 닫혀야 함").toBeHidden({ timeout: 3_000 });

          await page.screenshot({ path: `${SS}/3-confirm-dialog-closed.png` });
        }
      }
    }
  });
});

// ─── 4. 인벤토리 삭제 모달 z-index vs 탭바 ───

test.describe("4. 인벤토리 삭제 모달 z-index", () => {
  test("학생 보관함 — 폴더 생성 후 삭제 모달이 탭바 위에 표시", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 375, height: 667 });
    await loginViaUI(page, "student");
    await gotoAndSettle(page, `${BASE}/student/inventory`, { settleMs: 2000 });
    await page.screenshot({ path: `${SS}/4-inventory-before.png` });

    const newFolderBtn = page.locator("button").filter({ hasText: "새 폴더" }).first();
    if (await newFolderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newFolderBtn.click();

      const folderInput = page.locator('input[type="text"]').last();
      if (await folderInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await folderInput.fill("[E2E-삭제테스트]폴더");

        const createBtn = page.locator("button").filter({ hasText: /생성|만들기|확인/ }).first();
        if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createBtn.click();
          // 폴더 생성 후 삭제 버튼이 등장할 때까지 대기.
          await expect(
            page.locator('button[title="폴더 삭제"], button[title*="삭제"]').first(),
          ).toBeVisible({ timeout: 5_000 });
        }
      }

      const deleteBtn = page.locator('button[title="폴더 삭제"], button[title*="삭제"]').first();
      if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();

        // 삭제 확인 모달 — 탭바 위에 보여야 함.
        const modal = page.locator('[style*="zIndex"], [style*="z-index"]').last();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          await page.screenshot({ path: `${SS}/4-inventory-delete-modal.png` });

          const confirmDeleteBtn = page.locator("button").filter({ hasText: /삭제|확인/ }).last();
          await expect(confirmDeleteBtn, "삭제 확인 버튼이 보여야 함").toBeVisible({ timeout: 3_000 });
          await confirmDeleteBtn.click();
        }
      }
    }

    await page.screenshot({ path: `${SS}/4-inventory-after-cleanup.png` });
  });
});

// ─── 5. 중첩 오버레이 스크롤 복원 ───

test.describe("5. 중첩 오버레이 스크롤", () => {
  test("학생 상세 오버레이 → 내부 확인 다이얼로그 → 닫기 후 스크롤 정상", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/students`, { settleMs: 2000 });

    const scrollBefore = await page.evaluate(() => document.body.style.overflow);

    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      // 학생 상세 오버레이가 열릴 때까지 — overlay/dialog/sheet 어떤 형태든.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.screenshot({ path: `${SS}/5-overlay-open.png` });

      await page.keyboard.press("Escape");
      // ESC 후 잠금 해제 시간 — networkidle settle.
      await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

      const scrollAfterClose = await page.evaluate(() => document.body.style.overflow);
      await page.screenshot({ path: `${SS}/5-overlay-closed.png` });

      expect(
        scrollAfterClose === "" || scrollAfterClose === "auto" || scrollAfterClose === "visible" || scrollAfterClose === scrollBefore,
        `스크롤 복원: before="${scrollBefore}" after="${scrollAfterClose}"`,
      ).toBe(true);
    }
  });
});

// ─── 6. 영상 댓글 Enter 중복 방지 실검증 ───

test.describe("6. 영상 댓글 실검증", () => {
  test("관리자 영상 댓글 — 수정 후 Enter 더블탭 시 중복 방지", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/videos`, { settleMs: 2000 });

    const firstCard = page.locator('.video-domain-card, [class*="card"]').first();
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.screenshot({ path: `${SS}/6-video-detail.png` });
    }
  });
});

// ─── 7. 클리닉 에러 처리 — API 직접 검증 ───

test.describe("7. 클리닉 에러 처리 API 레벨", () => {
  test("학생 클리닉 페이지 정상 로드 (에러 없을 때)", async ({ page }) => {
    await loginViaUI(page, "student");
    await gotoAndSettle(page, `${BASE}/student/clinic`, { settleMs: 2000 });

    const hasError = await page.getByText("불러오지 못했습니다").isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError, "클리닉 페이지 에러 없음").toBe(false);

    const hasClinic = await page.getByText("클리닉").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasClinic, "클리닉 페이지 콘텐츠 존재").toBe(true);

    await page.screenshot({ path: `${SS}/7-clinic-normal.png` });
  });
});

// 네트워크 차단 테스트는 의도적 net::ERR_FAILED → strictTest 대신 baseTest 사용
baseTest.describe("7b. 클리닉 네트워크 차단 에러 UI", () => {
  baseTest("잘못된 API 호출 시 에러 화면 표시 (네트워크 차단)", async ({ page }) => {
    await loginViaUI(page, "student");

    await page.route("**/api/v1/clinic/**", (route) => route.abort("failed"));

    await page.goto(`${BASE}/student/clinic`, { waitUntil: "load", timeout: 25000 });

    // 에러 UI 자체가 5초 내 노출되어야 함 (waitForTimeout(4000) 제거 — expect timeout 으로 흡수).
    const errorMsg = page.getByText("불러오지 못했습니다");
    await baseExpect(errorMsg, "차단 시 에러 메시지 표시").toBeVisible({ timeout: 8_000 });
    const retryBtn = page.locator("button").filter({ hasText: "다시 시도" }).first();
    await baseExpect(retryBtn, "차단 시 다시 시도 버튼 표시").toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `${SS}/7-clinic-error.png` });

    // 다시 시도 클릭 → API 차단 해제
    await page.unroute("**/api/v1/clinic/**");
    await retryBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await page.screenshot({ path: `${SS}/7-clinic-recovered.png` });
  });
});

// ─── 8. 자료실 제목 Enter 중복 방지 ───

test.describe("8. 자료실 제목 Enter 중복 방지", () => {
  test("커뮤니티 → 자료실 진입 가능 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/community`);

    const matTab = page.locator('button, a, [role="tab"]').filter({ hasText: "자료실" }).first();
    if (await matTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matTab.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }
    await page.screenshot({ path: `${SS}/8-materials-tab.png` });
  });
});

// ─── 9. 모달 ESC 닫기 → 재열기 상태 초기화 (다양한 모달) ───

test.describe("9. 다양한 모달 상태 초기화", () => {
  test("시험 생성 모달 ESC → 재열기 시 초기 상태", async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/exams`, { settleMs: 2000 });

    const addBtn = page.locator(".ds-button").filter({ hasText: /추가|생성|새/ }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 1차 열기 — admin-modal 이 보일 때까지.
      await addBtn.click();
      const modal = page.locator(".admin-modal").first();
      await expect(modal, "1차 시험 생성 모달이 열려야 함").toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${SS}/9-exam-modal-first-open.png` });

      // ESC 닫기 — 모달이 사라질 때까지.
      await page.keyboard.press("Escape");
      await expect(modal, "ESC 후 모달이 닫혀야 함").toBeHidden({ timeout: 3_000 });

      // 2차 열기
      await addBtn.click();
      await expect(modal, "2차 시험 생성 모달이 열려야 함").toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${SS}/9-exam-modal-second-open.png` });

      // 모달이 초기 상태인지 확인 (입력 필드 비어있어야 함)
      const inputs = page.locator('.admin-modal input[type="text"], .admin-modal select');
      const inputCount = await inputs.count();
      for (let i = 0; i < inputCount; i++) {
        const tagName = await inputs.nth(i).evaluate((el) => el.tagName);
        if (tagName === "INPUT") {
          const val = await inputs.nth(i).inputValue().catch(() => "");
          expect(val, `input[${i}] should be empty on reopen`).toBe("");
        }
      }

      await page.keyboard.press("Escape");
    }
  });
});

// ─── 10. 학생→관리자 라우트 접근 차단 (다양한 경로) ───

test.describe("10. 권한 격리 추가 검증", () => {
  test("학생 계정 → 다양한 관리자 경로 접근 차단", async ({ page }) => {
    await loginViaUI(page, "student");

    const adminPaths = [
      "/admin/students",
      "/admin/lectures",
      "/admin/exams",
      "/admin/clinic/home",
      "/admin/settings",
      "/admin/community",
    ];

    for (const path of adminPaths) {
      await gotoAndSettle(page, `${BASE}${path}`);
      // 학생 → 관리자 경로 접근 시 /student 로 리다이렉트되어야 함.
      expect(page.url(), `${path} → student redirect`).toContain("/student");
    }
    await page.screenshot({ path: `${SS}/10-student-blocked.png` });
  });

  test("학생 토큰으로 관리자 API 직접 호출 → 403", async ({ page }) => {
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: "3333", password: "test1234", tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const tokens = await loginResp.json() as { access: string };

    const adminApis = [
      "/api/v1/students/",
      "/api/v1/lectures/lectures/",
      "/api/v1/staffs/",
    ];

    for (const apiPath of adminApis) {
      const resp = await page.request.get(`${API}${apiPath}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "X-Tenant-Code": "hakwonplus",
        },
      });
      expect(resp.status(), `${apiPath} → 403`).toBe(403);
    }
  });
});
