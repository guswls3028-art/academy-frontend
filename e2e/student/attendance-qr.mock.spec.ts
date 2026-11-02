import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { withQrCameraInput } from "../helpers/qrCameraInput";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5194";
const TOKEN = "70635f34-fef2-4536-b9a5-41bebcdf371a";
const QR_URL = `${BASE}/student/attendance/scan#qr=${TOKEN}`;
type Point = { id: number; label: string; kind: string; location: string; token: string; active: boolean; lecture_id: null };

async function installApi(page: Page, initialRole = "student", kind = "class") {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error("QR mocks require a local server");
  const state = {
    role: initialRole, kind, checkedIn: null as string | null, checkedOut: null as string | null,
    records: [] as string[], points: [] as Point[], failRecord: false,
  };
  const jwt = `e30.${Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 11, tenant_code: "hakwonplus" })).toString("base64url")}.qr`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token); localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "hakwonplus"); sessionStorage.setItem("tenantCode", "hakwonplus");
  }, jwt);
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QR 검증 학원", is_active: true, feature_flags: {}, ui_config: {} });
    if (path === "/core/me/") return json({ id: 11, name: "QR 학생", username: "qr-student", tenantRole: state.role, is_staff: state.role === "admin", is_superuser: state.role === "admin", must_change_password: false, linkedStudents: state.role === "parent" ? [{ id: 11, name: "QR 학생" }] : [] });
    if (path === "/student/me/") return json({ id: 11, name: "QR 학생", is_student: true, isParentReadOnly: state.role === "parent" });
    if (path === "/lectures/attendance-qr/") {
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        const point = { ...body, id: 1, active: true, token: TOKEN };
        state.points.push(point);
        return json(point, 201);
      }
      return json(state.points);
    }
    if (path === "/student/attendance/qr/resolve/") return json({
      point: { label: "301호 출결", kind: state.kind },
      choices: [{ id: 41, label: state.kind === "class" ? "오늘 수학" : "오늘 클리닉", date: "2026-10-31", start_time: "13:00:00",
        status: state.checkedIn ? (state.kind === "class" ? "PRESENT" : "attended") : (state.kind === "class" ? "UNSET" : "booked"),
        checked_in_at: state.checkedIn, checked_out_at: state.checkedOut,
        can_check_in: state.kind === "class" || !state.checkedIn, can_check_out: state.kind === "clinic" && Boolean(state.checkedIn),
      }],
    });
    if (path === "/student/attendance/qr/record/") {
      const body = req.postDataJSON();
      expect(body.token).toBe(TOKEN); expect(body.target_id).toBe(41);
      if (state.failRecord) return json({ detail: "저장 연결이 끊겼습니다. 다시 확인해 주세요." }, 409);
      const already = Boolean(body.action === "check_out" ? state.checkedOut : state.checkedIn);
      if (body.action === "check_out") state.checkedOut ||= "2026-10-31T05:00:00+09:00";
      else state.checkedIn ||= "2026-10-31T04:00:00+09:00";
      state.records.push(body.action);
      const word = body.action === "check_out" ? "하원" : state.kind === "class" ? "출석" : "등원";
      return json({ detail: already ? `이미 ${word} 기록이 있습니다.` : `${word}이 기록되었습니다.`, already_recorded: already, kind: state.kind, target_id: 41, status: "PRESENT",
        recorded_at: body.action === "check_out" ? state.checkedOut : state.checkedIn,
        checked_in_at: state.checkedIn, checked_out_at: state.checkedOut,
      });
    }
    if (path === "/student/attendance/summary/") return json({
      summary: { total: 1, present: state.checkedIn ? 1 : 0, absent: 0, late: 0, early_leave: 0, runaway: 0 },
      recent: [{ session_id: 41, lecture_title: "오늘 수학", session_title: "수학 차시", date: "2026-10-31", status: state.checkedIn ? "PRESENT" : "UNSET", can_view_session: false, qr_checked_in_at: state.checkedIn }],
    });
    if (path === "/clinic/participants/") return json(state.checkedIn ? [{ id: 41, student: 11, session: 51, session_title: "오늘 클리닉", session_date: "2026-10-31", session_start_time: "13:00:00", session_location: "301호", status: "attended", checked_in_at: state.checkedIn, checked_out_at: state.checkedOut, created_at: state.checkedIn, can_self_cancel: false }] : []);
    if (path === "/clinic/settings/") return json({ capabilities: { booking_policy: { read: true, write: true }, student_operations: { read: true, write: true } } });
    if (path === "/clinic/idcard/") return json({ current_targets: [], current_result: "SUCCESS" });
    if (path.startsWith("/clinic/sessions")) return json([]);
    return json({ results: [], count: 0, next: null, notices: [], today_sessions: [], badges: {} });
  });
  return state;
}

for (const width of [390, 1366]) {
  test(`QR link changes during lookup and reload use the latest link ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installApi(page);
    const nextToken = "e68a44ec-a70c-4eb6-b49d-56e570dc2ef7";
    const resolved: string[] = [];
    let releaseFirst!: () => void;
    const firstLookup = new Promise<void>((resolve) => { releaseFirst = resolve; });
    await page.route("**/api/v1/student/attendance/qr/resolve/", async (route) => {
      const token = route.request().postDataJSON().token as string;
      resolved.push(token);
      if (resolved.length === 1) await firstLookup;
      await route.fulfill({ json: {
        point: { label: token === nextToken ? "다음 교실 QR" : "첫 교실 QR", kind: "class" },
        choices: token === TOKEN ? [{ id: 41, label: "첫 교실 수업", date: "2026-10-31", start_time: null,
          status: "UNSET", checked_in_at: null, checked_out_at: null, can_check_in: true, can_check_out: false }] : [],
      } });
    });
    try {
      await page.goto(QR_URL);
      await expect.poll(() => resolved).toEqual([TOKEN]);
      await page.evaluate((token) => { window.location.hash = `qr=${token}`; }, nextToken);
      releaseFirst();
      await expect(page.getByRole("heading", { name: "다음 교실 QR", exact: true })).toBeVisible();
      expect(resolved).toEqual([TOKEN, nextToken]);
      expect(state.records).toEqual([]);
      await expect(page.getByLabel("카메라 미리보기", { exact: true })).toBeHidden();
      const cameraBounds = await page.getByRole("region", { name: "QR 카메라", exact: true }).boundingBox();
      const hintBounds = await page.getByText("QR 전체가 화면 안에 들어오도록 맞춰 주세요.", { exact: true }).boundingBox();
      expect(cameraBounds).not.toBeNull(); expect(hintBounds).not.toBeNull();
      expect(hintBounds!.y).toBeGreaterThanOrEqual(cameraBounds!.y);
      expect(hintBounds!.y + hintBounds!.height).toBeLessThanOrEqual(cameraBounds!.y + cameraBounds!.height);
      await page.screenshot({ path: test.info().outputPath(`qr-links-${width}.png`), fullPage: true });
      await page.reload();
      await expect(page.getByRole("heading", { name: "다음 교실 QR", exact: true })).toBeVisible();
      expect(resolved).toEqual([TOKEN, nextToken, nextToken]);
      await page.goBack();
      await expect(page.getByRole("heading", { name: "출석이 기록되었습니다.", exact: true })).toBeVisible();
      await expect(page.getByText("첫 교실 수업", { exact: true })).toBeVisible();
      expect(resolved).toEqual([TOKEN, nextToken, nextToken, TOKEN]);
      expect(state.records).toEqual(["check_in"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    } finally { releaseFirst(); }
  });

  test(`QR class save, retry, reload and attendance consumer ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installApi(page);
    state.failRecord = true;
    await page.goto(QR_URL);
    await expect(page.getByRole("alert")).toContainText("저장 연결이 끊겼습니다");
    state.failRecord = false;
    await page.getByRole("button", { name: "출석하기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "출석이 기록되었습니다." })).toBeVisible();
    await page.reload();
    await expect(page.getByText("이미 출석 기록이 있습니다.", { exact: true })).toBeVisible();
    expect(state.records).toEqual(["check_in", "check_in"]);
    await page.getByRole("link", { name: "내 출결 기록 보기" }).click();
    await page.reload();
    await expect(page.getByText("오늘 수학", { exact: true })).toBeVisible();
    await expect(page.getByText("출석", { exact: true }).last()).toBeVisible();
    await expect(page.getByText(/QR 04:00|QR 오전 04:00|QR 오전 4:00/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`qr-class-${width}.png`), fullPage: true });
  });

  test(`printed QR image decodes and clinic arrival/departure persist ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installApi(page, "admin", "clinic");
    await page.goto(`${BASE}/workspace/clinic/home`);
    await page.getByRole("button", { name: "출결 QR 출력", exact: true }).click();
    await page.getByLabel("인쇄할 이름").fill("301호 출결");
    await expect(page.getByRole("textbox", { name: /^클리닉 장소/ })).toHaveAccessibleName("클리닉 장소");
    await page.getByLabel("클리닉 장소", { exact: true }).fill("301호");
    await page.getByRole("button", { name: "QR 발급", exact: true }).click();
    const poster = page.getByLabel("출결 QR 인쇄 미리보기");
    await expect(poster.locator("svg")).toBeVisible();
    const photo = await poster.locator(".ant-qrcode").screenshot();
    expect(state.points[0].kind).toBe("clinic");
    expect(state.points[0].location).toBe("301호");
    // Observe the exact print document without opening an OS print dialog.
    await page.evaluate(() => {
      const append = document.body.appendChild.bind(document.body);
      document.body.appendChild = function <T extends Node>(node: T): T {
        const result = append(node);
        if (node instanceof HTMLIFrameElement && node.title === "출결 QR 인쇄" && node.contentWindow) {
          node.contentWindow.print = () => node.setAttribute("data-printed", "true");
        }
        return result;
      };
    });
    await page.getByRole("button", { name: "QR 인쇄·PDF 저장", exact: true }).click();
    const printFrame = page.locator('iframe[title="출결 QR 인쇄"]');
    await expect(printFrame).toHaveAttribute("data-printed", "true");
    const printContent = page.frameLocator('iframe[title="출결 QR 인쇄"]');
    await expect(printContent.getByRole("heading", { name: "301호 출결" })).toHaveCount(1);
    await expect(printContent.locator("svg")).toHaveCount(1);
    await expect(printContent.locator("body")).toContainText("들어올 때 등원 · 나갈 때 하원");
    await printFrame.evaluate((node: HTMLIFrameElement) => node.contentWindow?.dispatchEvent(new Event("afterprint")));
    await expect(printFrame).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`qr-poster-${width}.png`), fullPage: true });
    state.role = "student";
    await page.goto(`${BASE}/student/attendance/scan`);
    await page.locator('input[type="file"]').setInputFiles({ name: "door-qr.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByRole("button", { name: "등원하기", exact: true })).toBeVisible();
    expect(state.records).toEqual([]);
    await page.getByRole("button", { name: "등원하기", exact: true }).click();
    await expect(page.getByText("등원이 기록되었습니다.", { exact: true })).toBeVisible();
    for (const mode of ["denied", "unavailable"] as const) {
      await page.goto(`${BASE}/student/attendance/scan`);
      await withQrCameraInput(page, photo, async () => {
        await page.getByRole("button", { name: "카메라로 QR 스캔", exact: true }).click();
        await expect(page.getByRole("alert")).toContainText(mode === "denied" ? "카메라를 열지 못했습니다" : "실시간 카메라를 사용할 수 없습니다");
        await page.locator('input[type="file"]').setInputFiles({ name: "qr-recovery.png", mimeType: "image/png", buffer: photo });
        await expect(page.getByRole("button", { name: "하원하기", exact: true })).toBeVisible();
      }, mode);
      expect(state.records).toEqual(["check_in"]);
    }
    await page.goto(`${BASE}/student/attendance/scan`);
    await withQrCameraInput(page, photo, async () => {
      await page.getByRole("button", { name: "카메라로 QR 스캔", exact: true }).click();
      await expect(page.getByRole("button", { name: "하원하기", exact: true })).toBeVisible();
    });
    expect(state.records).toEqual(["check_in"]);
    await page.getByRole("button", { name: "하원하기", exact: true }).click();
    await expect(page.getByText("하원이 기록되었습니다.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "내 클리닉 기록 보기" }).click();
    await page.reload();
    const history = page.getByRole("region", { name: "최근 클리닉 등원·하원 기록" });
    await expect(history).toContainText("오늘 클리닉");
    await expect(history).toContainText("하원");
    expect(state.records).toEqual(["check_in", "check_out"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`qr-clinic-${width}.png`), fullPage: true });
  });
}

test("camera denial recovers with link; wrong origin and parent cannot write", async ({ page }) => {
  const state = await installApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: () => Promise.reject(new DOMException("denied", "NotAllowedError")) });
  });
  await page.goto(`${BASE}/student/attendance/scan`);
  await page.getByRole("button", { name: "카메라로 QR 스캔", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("카메라를 열지 못했습니다");
  await page.getByText("카메라 사용이 어려운가요?", { exact: true }).click();
  await page.getByLabel("출결 QR 링크").fill(QR_URL.replace(BASE, "https://other.example"));
  await page.getByRole("button", { name: "링크 확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("현재 로그인한 학원의 출결 QR이 아닙니다");
  expect(state.records).toEqual([]);
  await page.getByLabel("출결 QR 링크").fill(QR_URL);
  await page.getByRole("button", { name: "링크 확인", exact: true }).click();
  await expect(page.getByText("출석이 기록되었습니다.", { exact: true })).toBeVisible();
  state.role = "parent";
  await page.goto(`${BASE}/student/attendance`);
  await page.goto(QR_URL);
  await expect(page.getByText("QR 출석은 학생 본인 계정으로만 할 수 있습니다.", { exact: true })).toBeVisible();
  expect(state.records).toEqual(["check_in"]);
});
