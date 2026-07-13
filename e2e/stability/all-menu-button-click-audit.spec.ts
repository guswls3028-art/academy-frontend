import type { Locator, Page } from "@playwright/test";
// E2E_STRICT_IMPORT_EXCEPTION: rapid route aborts are classified by this spec's stricter HTTP/fatal collector.
import { test, expect } from "@playwright/test";
import { getBaseUrl, loginViaUI, type TenantRole } from "../helpers/auth";

type AuditRoute = {
  path: string;
  label: string;
};

type Candidate = {
  domIndex: number;
  tag: string;
  role: string;
  type: string;
  className: string;
  text: string;
  ariaLabel: string;
  title: string;
  href: string;
  rect: { x: number; y: number; width: number; height: number };
  disabled: boolean;
  inForm: boolean;
  skipReason?: string;
};

type RawCandidate = Candidate & {
  visible: boolean;
};

type RouteResult = {
  role: string;
  route: string;
  label: string;
  discovered: number;
  clicked: number;
  skipped: Array<{ label: string; reason: string }>;
};

type Defect = {
  role: string;
  route: string;
  action: string;
  detail: string;
};

type AuditReport = {
  routes: RouteResult[];
  defects: Defect[];
};

const BASE = trimTrailingSlash(getBaseUrl("admin"));

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const CLICKABLE_SELECTOR = [
  "button",
  "[role='button']",
  "[role='tab']",
  "[role='menuitem']",
  "a[href]",
  "summary",
  "input[type='button']",
  "input[type='submit']",
].join(", ");

const SAFE_QUERY_TEXT = /검색|조회|필터|새로고침|열기|닫기|취소|이전|다음|더보기|접기|펼치기|보기|미리보기|선택|전체|오늘|이번|지난|월|주|일|목록|돌아가기/i;

const MUTATION_OR_EXTERNAL_TEXT =
  /로그아웃|삭제|탈퇴|퇴원|제명|영구|발송|전송|보내기|알림톡|문자|SMS|저장|등록|생성|업로드|제출|승인|반려|거절|환불|결제|청구|정산|마감|확정|복구|동기화|분석|재분석|수정|변경|적용|초기화|잠금|차단|공개|비공개|예약|완료|처리|다운로드|인쇄|활성화|비활성화|사용\s*중지|사용\s*재개|운영\s*중지|운영\s*재개|켜기|끄기|토글|\bON\b|\bOFF\b/i;

const FATAL_TEXT =
  /Application error|Unhandled Runtime Error|ChunkLoadError|Cannot read properties|is not a function|Something went wrong|페이지를 불러오지 못했습니다|오류가 발생했습니다/i;
const TRANSIENT_OVERLAY_SELECTOR = [
  ".clinic-ops__trigger-preview-overlay",
  "[class*='fixed'][class*='inset-0'][class*='z-[90]']",
  "[data-radix-popper-content-wrapper]",
  ".ant-dropdown",
  ".ant-picker-dropdown",
  ".ant-popover",
  ".admin-modal-overlay",
  ".ant-modal",
  "[role='dialog'][aria-modal='true']",
  "[role='navigation'][aria-label='선생님 메뉴'][aria-hidden='false']",
].join(", ");
const MAX_REPEATED_ROW_CLICKS = 3;
const RECOVERABLE_RUNTIME_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RECOVERABLE_RUNTIME_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const pendingRuntimeDefects = new WeakMap<AuditReport, Map<string, Defect>>();

function runtimeDefectKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

function isRecoverableRuntimeMethod(method: string): boolean {
  return RECOVERABLE_RUNTIME_METHODS.has(method.toUpperCase());
}

function pendingDefectsFor(report: AuditReport): Map<string, Defect> {
  let pending = pendingRuntimeDefects.get(report);
  if (!pending) {
    pending = new Map<string, Defect>();
    pendingRuntimeDefects.set(report, pending);
  }
  return pending;
}

function deferRuntimeDefect(report: AuditReport, method: string, url: string, defect: Defect): void {
  pendingDefectsFor(report).set(runtimeDefectKey(method, url), defect);
}

function clearRecoveredRuntimeDefect(report: AuditReport, method: string, url: string): void {
  pendingRuntimeDefects.get(report)?.delete(runtimeDefectKey(method, url));
}

function flushPendingRuntimeDefects(report: AuditReport): void {
  const pending = pendingRuntimeDefects.get(report);
  if (!pending?.size) return;
  report.defects.push(...pending.values());
  pending.clear();
}

const ADMIN_ROUTES: AuditRoute[] = [
  { path: "/admin/dashboard", label: "관리자 대시보드" },
  { path: "/admin/students/home", label: "학생 홈" },
  { path: "/admin/students/requests", label: "학생 가입 신청" },
  { path: "/admin/students/deleted", label: "학생 퇴원/삭제" },
  { path: "/admin/lectures", label: "강의 운영" },
  { path: "/admin/lectures/past", label: "지난 강의" },
  { path: "/admin/materials/sheets", label: "자료 시트" },
  { path: "/admin/materials/reports", label: "자료 리포트" },
  { path: "/admin/materials/messages", label: "자료 메시지" },
  { path: "/admin/storage/matchup", label: "자료 저장소 매치업" },
  { path: "/admin/storage/files", label: "자료 저장소 파일" },
  { path: "/admin/storage/students", label: "학생 인벤토리" },
  { path: "/admin/storage/hit-reports", label: "적중 보고서" },
  { path: "/admin/storage/proposals", label: "자동 분리 검수" },
  { path: "/admin/fees", label: "수납 대시보드" },
  { path: "/admin/fees/invoices", label: "수납 청구" },
  { path: "/admin/fees/templates", label: "수납 템플릿" },
  { path: "/admin/clinic/home", label: "클리닉 홈" },
  { path: "/admin/clinic/operations", label: "클리닉 운영" },
  { path: "/admin/clinic/bookings", label: "클리닉 예약" },
  { path: "/admin/clinic/reports", label: "클리닉 리포트" },
  { path: "/admin/clinic/settings", label: "클리닉 설정" },
  { path: "/admin/clinic/msg-settings", label: "클리닉 메시지 설정" },
  { path: "/admin/exams", label: "시험" },
  { path: "/admin/exams/templates", label: "시험 템플릿" },
  { path: "/admin/exams/bundles", label: "시험 묶음" },
  { path: "/admin/results", label: "성적 탐색" },
  { path: "/admin/results/tree", label: "성적 트리" },
  { path: "/admin/results/submissions", label: "제출함" },
  { path: "/admin/videos", label: "영상" },
  { path: "/admin/videos/tree", label: "영상 트리" },
  { path: "/admin/counsel", label: "상담" },
  { path: "/admin/message/templates", label: "메시지 템플릿" },
  { path: "/admin/message/auto-send", label: "자동 발송" },
  { path: "/admin/message/log", label: "발송 로그" },
  { path: "/admin/message/settings", label: "메시지 설정" },
  { path: "/admin/community/board", label: "커뮤니티 게시판" },
  { path: "/admin/community/notice", label: "공지" },
  { path: "/admin/community/qna", label: "QnA" },
  { path: "/admin/community/counsel", label: "커뮤니티 상담" },
  { path: "/admin/community/materials", label: "커뮤니티 자료" },
  { path: "/admin/community/settings", label: "커뮤니티 설정" },
  { path: "/admin/community/reports", label: "커뮤니티 신고" },
  { path: "/admin/community/stats", label: "커뮤니티 통계" },
  { path: "/admin/landing-public/inbox", label: "공개 랜딩 문의" },
  { path: "/admin/tools/ppt", label: "PPT 도구" },
  { path: "/admin/tools/omr", label: "OMR 도구" },
  { path: "/admin/tools/clinic", label: "클리닉 출력 도구" },
  { path: "/admin/tools/stopwatch", label: "스톱워치" },
  { path: "/admin/tools/problem-studio", label: "문항 스튜디오" },
  { path: "/admin/guide", label: "관리자 가이드" },
  { path: "/admin/developer", label: "패치노트" },
  { path: "/admin/developer/bug", label: "버그 리포트" },
  { path: "/admin/developer/feedback", label: "피드백" },
  { path: "/admin/developer/flags", label: "기능 플래그" },
  { path: "/admin/staff/home", label: "직원 홈" },
  { path: "/admin/staff/attendance", label: "직원 근태" },
  { path: "/admin/staff/expenses", label: "직원 지출" },
  { path: "/admin/staff/month-lock", label: "월 마감" },
  { path: "/admin/staff/payroll-snapshot", label: "급여 스냅샷" },
  { path: "/admin/staff/reports", label: "직원 리포트" },
  { path: "/admin/staff/settings", label: "직원 설정" },
  { path: "/admin/settings/profile", label: "프로필 설정" },
  { path: "/admin/settings/organization", label: "학원 설정" },
  { path: "/admin/settings/appearance", label: "외형 설정" },
  { path: "/admin/settings/landing", label: "홈페이지 설정" },
  { path: "/admin/settings/consult", label: "상담 수신함" },
  { path: "/admin/settings/billing", label: "결제 설정" },
  { path: "/admin/profile/attendance", label: "내 근태" },
  { path: "/admin/profile/expense", label: "내 지출" },
];

const STUDENT_ROUTES: AuditRoute[] = [
  { path: "/student/dashboard", label: "학생 홈" },
  { path: "/student/video", label: "영상" },
  { path: "/student/video/courses/public", label: "공개 강좌" },
  { path: "/student/sessions", label: "일정" },
  { path: "/student/submit", label: "제출 허브" },
  { path: "/student/submit/score", label: "성적 제출" },
  { path: "/student/submit/assignment", label: "과제 제출" },
  { path: "/student/inventory", label: "내 인벤토리" },
  { path: "/student/exams", label: "시험" },
  { path: "/student/grades", label: "성적" },
  { path: "/student/profile", label: "프로필" },
  { path: "/student/settings", label: "설정" },
  { path: "/student/community", label: "커뮤니티" },
  { path: "/student/qna", label: "QnA" },
  { path: "/student/notices", label: "공지사항" },
  { path: "/student/notifications", label: "알림" },
  { path: "/student/idcard", label: "클리닉 인증 패스" },
  { path: "/student/clinic", label: "클리닉" },
  { path: "/student/attendance", label: "출결" },
  { path: "/student/fees", label: "수납" },
  { path: "/student/guide", label: "사용 가이드" },
];

const TEACHER_ROUTES: AuditRoute[] = [
  { path: "/teacher", label: "선생님 대시보드" },
  { path: "/teacher/students", label: "학생" },
  { path: "/teacher/classes", label: "강의" },
  { path: "/teacher/clinic", label: "클리닉" },
  { path: "/teacher/clinic/remote", label: "클리닉 리모컨" },
  { path: "/teacher/clinic/reports", label: "클리닉 리포트" },
  { path: "/teacher/exams", label: "시험" },
  { path: "/teacher/exams/templates", label: "시험 템플릿" },
  { path: "/teacher/exams/bundles", label: "시험 묶음" },
  { path: "/teacher/submissions", label: "제출함" },
  { path: "/teacher/results", label: "성적" },
  { path: "/teacher/videos", label: "영상" },
  { path: "/teacher/comms", label: "커뮤니티" },
  { path: "/teacher/message-log", label: "발송 이력" },
  { path: "/teacher/message-templates", label: "메시지 템플릿" },
  { path: "/teacher/messaging-settings", label: "메시징 설정" },
  { path: "/teacher/notifications", label: "알림" },
  { path: "/teacher/storage", label: "내 저장소" },
  { path: "/teacher/storage/inventory", label: "학생 인벤토리" },
  { path: "/teacher/counseling", label: "상담" },
  { path: "/teacher/fees", label: "수납" },
  { path: "/teacher/fees/invoices", label: "청구서" },
  { path: "/teacher/staff", label: "직원 관리" },
  { path: "/teacher/my-records", label: "내 근태/지출" },
  { path: "/teacher/profile", label: "프로필" },
  { path: "/teacher/billing", label: "결제" },
  { path: "/teacher/settings", label: "설정" },
  { path: "/teacher/settings/organization", label: "학원 설정" },
  { path: "/teacher/settings/appearance", label: "외형 설정" },
  { path: "/teacher/tools/stopwatch", label: "스톱워치" },
  { path: "/teacher/developer", label: "패치노트" },
  { path: "/teacher/developer/bug", label: "버그 리포트" },
  { path: "/teacher/developer/feedback", label: "피드백" },
  { path: "/teacher/desktop-only", label: "PC 기능 안내" },
];

const DEV_ROUTES: AuditRoute[] = [
  { path: "/dev/dashboard", label: "개발자 대시보드" },
  { path: "/dev/tenants", label: "테넌트" },
  { path: "/dev/billing", label: "결제" },
  { path: "/dev/inbox", label: "문의함" },
  { path: "/dev/automation", label: "자동화" },
  { path: "/dev/agents", label: "에이전트" },
];

function selectedRoutes(routes: AuditRoute[]): AuditRoute[] {
  const filter = process.env.E2E_CLICK_AUDIT_ROUTE_FILTER?.trim();
  if (!filter) return routes;
  const filters = filter
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return routes.filter((route) => filters.some((item) => route.path.includes(item) || route.label.includes(item)));
}

function hasRouteFilter(): boolean {
  return Boolean(process.env.E2E_CLICK_AUDIT_ROUTE_FILTER?.trim());
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function routeUrl(path: string): string {
  return `${BASE}${path}`;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function labelOf(candidate: Candidate): string {
  return normalizeSpaces(
    [candidate.ariaLabel, candidate.text, candidate.title, candidate.href]
      .filter(Boolean)
      .join(" ")
  ).slice(0, 160) || `${candidate.tag}[${candidate.domIndex}]`;
}

function classifySkip(candidate: Candidate): string | undefined {
  const label = labelOf(candidate);
  const href = candidate.href.trim();

  if (candidate.disabled) return "disabled";
  if (/^javascript:/i.test(href)) return "javascript href";
  if (/^mailto:|^tel:/i.test(href)) return "external protocol";
  if (/\/login(?:\/|$|\?)/i.test(href)) return "login route";
  if (/\/logout(?:\/|$|\?)/i.test(href)) return "logout route";
  if (/\blanding-nav-/.test(candidate.className)) return "public landing preview navigation";
  if (/학원 홈페이지로 이동|홈페이지로 이동|공개 홈페이지/i.test(label)) return "outside role app navigation";
  if (candidate.type === "submit" && candidate.inForm && !SAFE_QUERY_TEXT.test(label)) return "submit/write control";
  if (MUTATION_OR_EXTERNAL_TEXT.test(label) && !SAFE_QUERY_TEXT.test(label)) {
    return "production mutation or external side effect";
  }
  return undefined;
}

function internalAnchorKey(candidate: Candidate): string | undefined {
  if (candidate.tag !== "a" || !candidate.href) return undefined;
  try {
    const url = new URL(candidate.href, BASE);
    if (url.origin !== new URL(BASE).origin) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

function roleBoundarySkip(candidate: Candidate, role: string): string | undefined {
  const internalKey = internalAnchorKey(candidate);
  if (!internalKey) return undefined;

  const path = internalKey.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const prefixesByRole: Record<string, string[]> = {
    admin: ["/admin"],
    dev: ["/dev"],
    student: ["/student"],
    teacher: ["/teacher"],
  };
  const prefixes = prefixesByRole[role] ?? [];
  if (!prefixes.length) return undefined;

  const insideRoleApp = prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return insideRoleApp ? undefined : `outside ${role} app boundary`;
}

function repeatedRowKey(candidate: Candidate): string | undefined {
  if (candidate.href) return undefined;
  const label = labelOf(candidate);
  if (label.length < 24) return undefined;
  const classKey = candidate.className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(".");
  if (!classKey) return undefined;
  return `${candidate.tag}:${candidate.role}:${candidate.type}:${classKey}`;
}

async function installRuntimeGuards(page: Page, report: AuditReport, role: string): Promise<void> {
  page.context().on("page", async (popup) => {
    await popup.close().catch(() => undefined);
  });
  page.on("dialog", async (dialog) => {
    await dialog.dismiss().catch(() => undefined);
  });
  page.on("filechooser", async (chooser) => {
    await chooser.setFiles([]).catch(() => undefined);
  });
  page.on("download", async (download) => {
    await download.delete().catch(() => undefined);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (!isAppUrl(url)) return;

    const method = response.request().method().toUpperCase();
    if (status < 500) {
      clearRecoveredRuntimeDefect(report, method, url);
      return;
    }

    const defect: Defect = {
      role,
      route: currentPathSafe(page),
      action: "network",
      detail: `${method} ${status} ${url}`,
    };
    if (isRecoverableRuntimeMethod(method) && RECOVERABLE_RUNTIME_STATUSES.has(status)) {
      deferRuntimeDefect(report, method, url, defect);
    } else {
      report.defects.push(defect);
    }
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    if (/ERR_ABORTED|NS_BINDING_ABORTED|net::ERR_FAILED|Target page|Frame was detached/i.test(errorText)) return;
    const url = request.url();
    if (!isAppUrl(url)) return;
    const method = request.method().toUpperCase();
    const defect: Defect = {
      role,
      route: currentPathSafe(page),
      action: "requestfailed",
      detail: `${method} ${errorText} ${url}`,
    };
    if (isRecoverableRuntimeMethod(method)) {
      deferRuntimeDefect(report, method, url, defect);
    } else {
      report.defects.push(defect);
    }
  });
}

function isAppUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const baseUrl = new URL(BASE);
    return url.origin === baseUrl.origin || /api\.hakwonplus\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function currentPathSafe(page: Page): string {
  try {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  } catch {
    return page.url();
  }
}

function isAtRoute(page: Page, route: AuditRoute): boolean {
  const current = currentPathSafe(page).split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const expected = route.path.replace(/\/+$/, "") || "/";
  return current === expected;
}

async function waitForNextFrame(page: Page): Promise<void> {
  await page
    .evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    )
    .catch(() => undefined);
}

async function waitForSettledPage(page: Page, networkIdleTimeout = 1_500): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: networkIdleTimeout }).catch(() => undefined);
  await waitForNextFrame(page);
}

function isRetryableNavigationError(message: string): boolean {
  return /Timeout|ERR_CONNECTION_CLOSED|ERR_TIMED_OUT|ERR_HTTP2_PROTOCOL_ERROR|interrupted by another navigation|NS_BINDING_ABORTED/i.test(message);
}

async function assertUsablePage(page: Page, report: AuditReport, role: string, route: AuditRoute, action: string): Promise<void> {
  await waitForSettledPage(page);
  const path = currentPathSafe(page);
  if (/\/login(?:\/|$|\?)/i.test(path)) {
    report.defects.push({
      role,
      route: route.path,
      action,
      detail: `unexpected login redirect at ${path}`,
    });
    return;
  }

  let bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  let normalized = normalizeSpaces(bodyText);
  if (normalized.length < 2) {
    await waitForSettledPage(page, 3_000);
    bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    normalized = normalizeSpaces(bodyText);
  }
  if (normalized.length < 2) {
    report.defects.push({
      role,
      route: route.path,
      action,
      detail: "blank or nearly blank body",
    });
  }
  if (FATAL_TEXT.test(normalized)) {
    report.defects.push({
      role,
      route: route.path,
      action,
      detail: `fatal text detected: ${normalized.slice(0, 300)}`,
    });
  }
}

async function gotoRoute(page: Page, route: AuditRoute): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(routeUrl(route.path), { waitUntil: "commit", timeout: 45_000 });
      await waitForSettledPage(page, 3_000);
      return;
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message || error);
      if (attempt === 1 || !isRetryableNavigationError(message)) {
        throw error;
      }
      await page.goto("about:blank", { waitUntil: "commit", timeout: 5_000 }).catch(() => undefined);
      await waitForNextFrame(page);
    }
  }
  throw lastError;
}

async function collectCandidates(page: Page, scopeSelector = "body"): Promise<Candidate[]> {
  const scope = page.locator(scopeSelector).first();
  const locator = scope.locator(CLICKABLE_SELECTOR);
  let raw: RawCandidate[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      raw = await locator.evaluateAll((elements) =>
        elements.map((el, domIndex) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute("role") ?? "";
          const type = (el as HTMLButtonElement | HTMLInputElement).type ?? "";
          const className = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "";
          const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
          const ariaLabel = el.getAttribute("aria-label") ?? "";
          const title = el.getAttribute("title") ?? "";
          const href = el instanceof HTMLAnchorElement ? el.href : "";
          const inForm =
            (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
            el.form instanceof HTMLFormElement;
          const disabled =
            (el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el.disabled : false) ||
            el.getAttribute("aria-disabled") === "true";
          const visible =
            rect.width >= 4 &&
            rect.height >= 4 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0";

          return {
            domIndex,
            tag,
            role,
            type,
            className,
            text,
            ariaLabel,
            title,
            href,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            disabled,
            inForm,
            visible,
          };
        })
      );
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await waitForSettledPage(page, 2_000);
    }
  }

  return raw
    .filter((item) => item.visible)
    .map((item) => {
      const candidate: Candidate = {
        domIndex: item.domIndex,
        tag: item.tag,
        role: item.role,
        type: item.type,
        className: item.className,
        text: item.text,
        ariaLabel: item.ariaLabel,
        title: item.title,
        href: item.href,
        rect: item.rect,
        disabled: item.disabled,
        inForm: item.inForm,
      };
      const skipReason = classifySkip(candidate);
      return skipReason ? { ...candidate, skipReason } : candidate;
    });
}

async function closeTransientUi(page: Page): Promise<void> {
  await page.mouse.move(0, 0).catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  await waitForNextFrame(page);
  const drawerClose = page
    .locator("[role='navigation'][aria-label='선생님 메뉴'] button[aria-label='닫기'], [role='dialog'][aria-label='메뉴'] button[aria-label='닫기']")
    .first();
  if (await drawerClose.isVisible({ timeout: 500 }).catch(() => false)) {
    await drawerClose.click({ timeout: 2_000 }).catch(() => undefined);
    await waitForNextFrame(page);
  }

  const closers = page
    .locator("button, [role='button']")
    .filter({ hasText: /^(닫기|취소|아니오|나중에|Close)$/ });

  for (let i = 0; i < 3; i += 1) {
    const count = await closers.count().catch(() => 0);
    if (count === 0) break;
    const button = closers.first();
    if (!(await button.isVisible().catch(() => false))) break;
    await button.click({ timeout: 2_000 }).catch(() => undefined);
    await waitForNextFrame(page);
  }

  const overlay = page.locator(TRANSIENT_OVERLAY_SELECTOR).first();
  if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await overlay.click({ position: { x: 6, y: 6 }, timeout: 2_000 }).catch(() => undefined);
    await waitForNextFrame(page);
    await page.keyboard.press("Escape").catch(() => undefined);
    await waitForNextFrame(page);
  }
}

async function hasBlockingOverlay(page: Page): Promise<boolean> {
  const overlay = page.locator(TRANSIENT_OVERLAY_SELECTOR).first();
  return overlay.isVisible({ timeout: 500 }).catch(() => false);
}

function isRetryableClickError(message: string): boolean {
  return /intercepts pointer events|subtree intercepts pointer events|not stable|element is not attached|Target closed/i.test(message);
}

async function clickTargetLikeUser(page: Page, target: Locator, networkIdleTimeout: number): Promise<string | undefined> {
  if (!(await target.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return "stale or hidden before click";
  }
  await target.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => undefined);

  let clickError = await target.click({ timeout: 5_000 }).then(() => undefined, (error: Error) => error.message);
  if (clickError && isRetryableClickError(clickError)) {
    await closeTransientUi(page);
    await target.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => undefined);
    clickError = await target.click({ timeout: 5_000 }).then(() => undefined, (error: Error) => error.message);
  }
  if (clickError && /intercepts pointer events|subtree intercepts pointer events/i.test(clickError)) {
    await closeTransientUi(page);
    if (!(await hasBlockingOverlay(page))) {
      clickError = await target.click({ force: true, timeout: 3_000 }).then(() => undefined, (error: Error) => error.message);
    }
  }
  if (clickError) return clickError;

  await waitForSettledPage(page, networkIdleTimeout);
  await closeTransientUi(page);
  return undefined;
}

async function clickCandidate(page: Page, candidate: Candidate): Promise<string | undefined> {
  return clickTargetLikeUser(page, page.locator(CLICKABLE_SELECTOR).nth(candidate.domIndex), candidate.href ? 3_000 : 1_000);
}

async function auditRoutes({
  page,
  report,
  role,
  routes,
  seenInternalLinks,
}: {
  page: Page;
  report: AuditReport;
  role: string;
  routes: AuditRoute[];
  seenInternalLinks: Set<string>;
}): Promise<void> {
  for (const route of routes) {
    await gotoRoute(page, route);
    await assertUsablePage(page, report, role, route, "route-open");

    const snapshot = await collectCandidates(page);
    const result: RouteResult = {
      role,
      route: route.path,
      label: route.label,
      discovered: snapshot.length,
      clicked: 0,
      skipped: [],
    };
    const repeatedCounts = new Map<string, number>();

    for (const candidate of snapshot) {
      const label = labelOf(candidate);
      const internalKey = internalAnchorKey(candidate);
      const repeatKey = repeatedRowKey(candidate);

      if (candidate.skipReason) {
        result.skipped.push({ label, reason: candidate.skipReason });
        continue;
      }
      const boundaryReason = roleBoundarySkip(candidate, role);
      if (boundaryReason) {
        result.skipped.push({ label, reason: boundaryReason });
        continue;
      }
      if (repeatKey) {
        const seen = repeatedCounts.get(repeatKey) ?? 0;
        if (seen >= MAX_REPEATED_ROW_CLICKS) {
          result.skipped.push({ label, reason: "repeated row/control representative already clicked" });
          continue;
        }
        repeatedCounts.set(repeatKey, seen + 1);
      }
      if (internalKey && seenInternalLinks.has(internalKey)) {
        result.skipped.push({ label, reason: "duplicate internal menu/link already clicked" });
        continue;
      }

      await closeTransientUi(page);
      if (!isAtRoute(page, route) || await hasBlockingOverlay(page)) {
        await gotoRoute(page, route);
      }
      let fresh = (await collectCandidates(page)).find((item) => item.domIndex === candidate.domIndex);
      if (!fresh) {
        await gotoRoute(page, route);
        fresh = (await collectCandidates(page)).find((item) => item.domIndex === candidate.domIndex);
      }
      if (!fresh) {
        result.skipped.push({ label, reason: "stale candidate after reload" });
        continue;
      }
      if (fresh.skipReason) {
        result.skipped.push({ label, reason: fresh.skipReason });
        continue;
      }
      const freshBoundaryReason = roleBoundarySkip(fresh, role);
      if (freshBoundaryReason) {
        result.skipped.push({ label, reason: freshBoundaryReason });
        continue;
      }

      const clickError = await clickCandidate(page, fresh);
      if (clickError) {
        if (clickError === "stale or hidden before click") {
          result.skipped.push({ label: labelOf(fresh), reason: clickError });
          continue;
        }
        report.defects.push({
          role,
          route: route.path,
          action: labelOf(fresh),
          detail: clickError,
        });
      } else {
        result.clicked += 1;
        const freshInternalKey = internalAnchorKey(fresh);
        if (freshInternalKey) seenInternalLinks.add(freshInternalKey);
        await assertUsablePage(page, report, role, route, labelOf(fresh));
      }
    }

    report.routes.push(result);
    console.log(
      `[click-audit] ${role} ${route.path}: discovered=${result.discovered} clicked=${result.clicked} skipped=${result.skipped.length}`
    );
  }
}

async function auditDrawerMenu({
  page,
  report,
  role,
  startRoute,
  scopeSelector,
  seenInternalLinks,
}: {
  page: Page;
  report: AuditReport;
  role: string;
  startRoute: AuditRoute;
  scopeSelector: string;
  seenInternalLinks: Set<string>;
}): Promise<void> {
  await gotoRoute(page, startRoute);
  const menuButton = page.getByRole("button", { name: /메뉴(?:\s*열기)?/ }).first();
  if (!(await menuButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
    report.defects.push({
      role,
      route: startRoute.path,
      action: "drawer-open",
      detail: "menu button not visible",
    });
    return;
  }

  await menuButton.click();
  await waitForSettledPage(page);
  const snapshot = await collectCandidates(page, scopeSelector);
  const result: RouteResult = {
    role,
    route: `${startRoute.path} drawer`,
    label: `${role} drawer menu`,
    discovered: snapshot.length,
    clicked: 0,
    skipped: [],
  };

  for (const candidate of snapshot) {
    const label = labelOf(candidate);
    const internalKey = internalAnchorKey(candidate);

    if (candidate.skipReason || /닫기|로그아웃/i.test(label)) {
      result.skipped.push({ label, reason: candidate.skipReason ?? "drawer close/logout" });
      continue;
    }
    const boundaryReason = roleBoundarySkip(candidate, role);
    if (boundaryReason) {
      result.skipped.push({ label, reason: boundaryReason });
      continue;
    }
    if (internalKey && seenInternalLinks.has(internalKey)) {
      result.skipped.push({ label, reason: "duplicate internal menu/link already clicked" });
      continue;
    }

    await gotoRoute(page, startRoute);
    await page.getByRole("button", { name: "메뉴" }).first().click();
    await waitForSettledPage(page);
    const fresh = (await collectCandidates(page, scopeSelector)).find((item) => item.domIndex === candidate.domIndex);
    if (!fresh || fresh.skipReason) {
      result.skipped.push({ label, reason: fresh?.skipReason ?? "stale drawer candidate" });
      continue;
    }
    const freshBoundaryReason = roleBoundarySkip(fresh, role);
    if (freshBoundaryReason) {
      result.skipped.push({ label, reason: freshBoundaryReason });
      continue;
    }

    const target = page.locator(scopeSelector).first().locator(CLICKABLE_SELECTOR).nth(fresh.domIndex);
    const clickError = await clickTargetLikeUser(page, target, 1_500);
    if (await hasBlockingOverlay(page)) {
      await gotoRoute(page, startRoute);
    }

    if (clickError) {
      if (clickError === "stale or hidden before click") {
        result.skipped.push({ label: labelOf(fresh), reason: clickError });
        continue;
      }
      report.defects.push({
        role,
        route: `${startRoute.path} drawer`,
        action: labelOf(fresh),
        detail: clickError,
      });
    } else {
      result.clicked += 1;
      const freshInternalKey = internalAnchorKey(fresh);
      if (freshInternalKey) seenInternalLinks.add(freshInternalKey);
      await assertUsablePage(page, report, role, startRoute, labelOf(fresh));
    }
  }

  report.routes.push(result);
  await closeTransientUi(page);
  if (await hasBlockingOverlay(page)) {
    await gotoRoute(page, startRoute);
  }
  console.log(
    `[click-audit] ${role} drawer: discovered=${result.discovered} clicked=${result.clicked} skipped=${result.skipped.length}`
  );
}

async function loginForAudit(page: Page, authRole: TenantRole, landingPath: string): Promise<void> {
  await loginViaUI(page, authRole, { landingPath });
  await page.evaluate(() => {
    localStorage.removeItem("teacher:preferAdmin");
  });
  await waitForSettledPage(page);
}

async function attachReport(report: AuditReport): Promise<void> {
  flushPendingRuntimeDefects(report);
  await test.info().attach("all-menu-button-click-audit.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(report, null, 2), "utf-8"),
  });
}

test.describe("전 메뉴/버튼 사람형 클릭 감사 - 데스크톱", () => {
  test("관리자 + 개발자 데스크톱 메뉴/버튼", async ({ page }) => {
    test.setTimeout(5_400_000);
    const report: AuditReport = { routes: [], defects: [] };
    const seenInternalLinks = new Set<string>();
    await installRuntimeGuards(page, report, "admin-dev");

    await loginForAudit(page, "admin", "/admin/dashboard");
    await auditRoutes({ page, report, role: "admin", routes: selectedRoutes(ADMIN_ROUTES), seenInternalLinks });

    await loginForAudit(page, "admin", "/dev/dashboard");
    await auditRoutes({ page, report, role: "dev", routes: selectedRoutes(DEV_ROUTES), seenInternalLinks });

    await attachReport(report);
    expect(report.defects, JSON.stringify(report.defects, null, 2)).toEqual([]);
  });
});

test.describe("전 메뉴/버튼 사람형 클릭 감사 - 모바일", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test("학생 모바일 메뉴/버튼", async ({ page }) => {
    test.setTimeout(1_500_000);
    const report: AuditReport = { routes: [], defects: [] };
    const seenInternalLinks = new Set<string>();
    await installRuntimeGuards(page, report, "student");

    await loginForAudit(page, "student", "/student/dashboard");
    if (!hasRouteFilter()) {
      await auditDrawerMenu({
        page,
        report,
        role: "student",
        startRoute: { path: "/student/dashboard", label: "학생 홈" },
        scopeSelector: "[role='dialog'][aria-label='메뉴']",
        seenInternalLinks,
      });
    }
    await auditRoutes({ page, report, role: "student", routes: selectedRoutes(STUDENT_ROUTES), seenInternalLinks });

    await attachReport(report);
    expect(report.defects, JSON.stringify(report.defects, null, 2)).toEqual([]);
  });

  test("선생님 모바일 메뉴/버튼", async ({ page }) => {
    test.setTimeout(2_400_000);
    const report: AuditReport = { routes: [], defects: [] };
    const seenInternalLinks = new Set<string>();
    await installRuntimeGuards(page, report, "teacher");

    await loginForAudit(page, "admin", "/teacher");
    if (!hasRouteFilter()) {
      await auditDrawerMenu({
        page,
        report,
        role: "teacher",
        startRoute: { path: "/teacher", label: "선생님 홈" },
        scopeSelector: "[role='navigation'][aria-label='선생님 메뉴']",
        seenInternalLinks,
      });
    }
    await auditRoutes({ page, report, role: "teacher", routes: selectedRoutes(TEACHER_ROUTES), seenInternalLinks });

    await attachReport(report);
    expect(report.defects, JSON.stringify(report.defects, null, 2)).toEqual([]);
  });
});
