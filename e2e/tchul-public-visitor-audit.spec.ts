/**
 * tchul 공개 홈페이지 전체 방문 동선 감사.
 *
 * 운영 데이터는 조회만 하며, 현재 공개된 상세 ID를 API에서 읽어 목록/상세를
 * 데스크톱과 모바일에서 끝까지 렌더한다. 한 화면의 결함 때문에 뒤 화면 검수가
 * 중단되지 않도록 결함을 누적한 뒤 마지막에 한 번만 실패시킨다.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { resolvePublicProgramCopy } from "../src/landing/utils/publicProgramCopy";
import { expect, test } from "./fixtures/strictTest";
import { attachStrictBrowserGuards } from "./helpers/strictBrowser";

const BASE_URL = (process.env.TCHUL_AUDIT_BASE_URL || "https://tchul.com").replace(/\/+$/, "");
const API_URL = (process.env.TCHUL_AUDIT_API_URL || "https://api.hakwonplus.com").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.TCHUL_AUDIT_ARTIFACT_DIR || "e2e/screenshots/tchul-public-visitor-audit";
const TENANT_HEADERS = { "X-Tenant-Code": "tchul", Accept: "application/json" };

type ViewportAudit = { name: string; width: number; height: number };
type AuditRoute = {
  name: string;
  path: string;
  expectedText?: RegExp;
  expectedPath?: RegExp;
  inlineMatchupPdf?: boolean;
};

const VIEWPORTS: ViewportAudit[] = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function slug(value: string): string {
  return value.replace(/^\/+/, "").replace(/[^a-zA-Z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "home";
}

async function fetchJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${API_URL}/api/v1${path}`, { headers: TENANT_HEADERS, timeout: 30_000 });
  expect(response.ok(), `GET ${path}`).toBeTruthy();
  return await response.json() as T;
}

async function buildRouteInventory(request: APIRequestContext): Promise<AuditRoute[]> {
  const [landing, matchup] = await Promise.all([
    fetchJson<{ config?: { sections?: Array<{ type: string; enabled?: boolean; items?: Array<{ report_id?: number }> }> } }>(request, "/core/landing/public/"),
    fetchJson<{ results?: Array<{ id: number; title: string }> }>(request, "/landing-public/matchup-showcase/"),
  ]);

  const reportIds = (landing.config?.sections || [])
    .find((section) => section.type === "hit_reports" && section.enabled !== false)
    ?.items?.map((item) => Number(item.report_id))
    .filter((id) => Number.isFinite(id)) || [];
  const matchupIds = (matchup.results || []).map((item) => Number(item.id)).filter(Number.isFinite);

  return [
    { name: "홈", path: "/landing", expectedText: /박철T 통합과학/ },
    { name: "학원 소개", path: "/landing/about", expectedText: /박철 과학 소개/ },
    { name: "가이드", path: "/landing/guide", expectedText: /가이드/ },
    { name: "매치업 자료실", path: "/landing/matchup-board", expectedText: /매치업 자료실/ },
    ...matchupIds.map((id) => ({
      name: `매치업 상세 ${id}`,
      path: `/landing/matchup-board/${id}`,
      expectedText: /전체 자료|모든 페이지가 순서대로/,
      inlineMatchupPdf: true,
    })),
    { name: "자동 적중보고서", path: "/landing/reports", expectedText: /학교별 적중 사례/ },
    ...reportIds.map((id) => ({ name: `자동 적중보고서 상세 ${id}`, path: `/landing/reports/${id}`, expectedText: /PDF 전체 보기/ })),
    { name: "자유게시판", path: "/landing/board", expectedText: /자유게시판/ },
    { name: "수강 후기", path: "/landing/reviews", expectedText: /수강 후기/ },
    { name: "성적 통계", path: "/landing/scores", expectedText: /시험 결과 통계/ },
    { name: "가족 자유게시판", path: "/landing/community/board", expectedText: /학원 가족만 볼 수 있어요/ },
    { name: "질문게시판", path: "/landing/community/qna", expectedText: /학원 가족만 볼 수 있어요/ },
    { name: "공지사항", path: "/landing/community/notice", expectedText: /학원 가족만 볼 수 있어요/ },
    { name: "자료실", path: "/landing/community/materials", expectedText: /학원 가족만 볼 수 있어요/ },
    { name: "잘못된 커뮤니티 경로 복구", path: "/landing/community/not-a-board", expectedPath: /\/landing\/community\/board\/?$/ },
    { name: "커뮤니티 글 비회원 보호", path: "/landing/community/board/posts/999999999", expectedText: /학원 가족만 볼 수 있는 글이에요/ },
    { name: "자유게시판 글쓰기", path: "/landing/board/write", expectedPath: /\/login(?:\?|$)/ },
    { name: "자유게시판 수정", path: "/landing/board/999999999/edit", expectedPath: /\/login(?:\?|$)/ },
    { name: "수강 후기 쓰기", path: "/landing/reviews/write", expectedPath: /\/login(?:\?|$)/ },
    { name: "질문 글쓰기", path: "/landing/community/qna/write", expectedText: /글 작성은 로그인 후에|로그인 후 이용/ },
    { name: "없는 자유게시판 글", path: "/landing/board/999999999", expectedText: /찾을 수 없습니다/ },
    { name: "없는 후기", path: "/landing/reviews/999999999", expectedText: /찾을 수 없습니다/ },
    { name: "없는 성적 통계", path: "/landing/scores/999999999", expectedText: /찾을 수 없습니다/ },
    { name: "없는 매치업", path: "/landing/matchup-board/999999999", expectedText: /찾을 수 없습니다|공개되지 않은/ },
    { name: "없는 자동 보고서", path: "/landing/reports/999999999", expectedText: /찾을 수 없습니다|불러올 수 없습니다/ },
    { name: "유효하지 않은 공유 링크", path: "/landing/share/00000000-0000-0000-0000-000000000000", expectedText: /유효하지 않|찾을 수 없|만료/ },
    { name: "잘못된 공개 경로 복구", path: "/landing/not-a-public-page", expectedPath: /\/landing\/?$/ },
  ];
}

async function auditRoute(page: Page, route: AuditRoute, viewport: ViewportAudit, screenshotDir: string): Promise<string[]> {
  const defects: string[] = [];
  const url = `${BASE_URL}${route.path}`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => (document.body?.innerText || "").trim().length > 20, undefined, { timeout: 15_000 });
    await page.waitForFunction(() => Array.from(document.images).every((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width < 2 || rect.height < 2 || image.complete;
    }), undefined, { timeout: 5_000 }).catch(() => undefined);
    if (route.expectedText) {
      await page.waitForFunction(
        ({ source, flags }) => new RegExp(source, flags).test(document.body?.innerText || ""),
        { source: route.expectedText.source, flags: route.expectedText.flags },
        { timeout: 10_000 },
      ).catch(() => undefined);
    }
    await page.evaluate(async () => {
      const step = Math.max(420, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 8_000 }).catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
  } catch (error) {
    defects.push(`탐색 실패: ${String(error)}`);
  }

  const finalUrl = page.url();
  if (route.expectedPath && !route.expectedPath.test(new URL(finalUrl).pathname + new URL(finalUrl).search)) {
    defects.push(`예상 경로 ${route.expectedPath}와 다름: ${finalUrl}`);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (route.expectedText && !route.expectedText.test(bodyText)) {
    defects.push(`필수 문구 ${route.expectedText} 없음`);
  }
  if (route.inlineMatchupPdf) {
    const download = page.getByRole("link", { name: "원본 PDF 다운로드" });
    const pdfHref = await download.getAttribute("href").catch(() => null);
    if (!pdfHref) {
      defects.push("원본 PDF 다운로드 주소 없음");
    } else {
      const parsed = new URL(pdfHref, finalUrl);
      const localAudit = ["127.0.0.1", "localhost"].includes(new URL(BASE_URL).hostname);
      const expectedHost = localAudit ? new URL(BASE_URL).hostname : "api.hakwonplus.com";
      if (parsed.hostname !== expectedHost) defects.push(`PDF 원본 호스트가 잘못됨: ${parsed.hostname}`);
      if (parsed.searchParams.get("tenant") !== "tchul") defects.push("PDF 원본 tenant 누락");
      const pdfResponse = await page.request.get(parsed.toString(), { headers: TENANT_HEADERS, timeout: 30_000 }).catch(() => null);
      const contentType = pdfResponse?.headers()["content-type"] || "";
      if (!pdfResponse?.ok() || !/application\/pdf/i.test(contentType)) {
        defects.push(`PDF 원본 응답 실패: ${pdfResponse?.status() || "no response"} ${contentType}`);
      }
      await pdfResponse?.dispose();
    }

    if (await page.locator("iframe").count()) defects.push("브라우저 내장 PDF iframe이 남아 있음");
    if (await page.getByRole("link", { name: "새 창에서 크게 보기" }).count()) defects.push("새 창 보기 버튼이 남아 있음");
    const inlineDocument = page.getByTestId("matchup-inline-pdf");
    const pageCount = Number(await inlineDocument.getAttribute("data-page-count").catch(() => 0));
    const pages = page.getByTestId("matchup-pdf-page");
    if (!Number.isFinite(pageCount) || pageCount < 1) {
      defects.push("연속 본문 페이지 수를 확인할 수 없음");
    } else if (await pages.count() !== pageCount) {
      defects.push(`연속 본문 페이지 누락: ${await pages.count()}/${pageCount}`);
    } else {
      for (let index = 0; index < pageCount; index += 1) {
        const pdfPage = pages.nth(index);
        await pdfPage.scrollIntoViewIfNeeded().catch(() => undefined);
        const rendered = await expect(pdfPage)
          .toHaveAttribute("data-render-status", "ready", { timeout: 30_000 })
          .then(() => true)
          .catch(() => false);
        if (!rendered) {
          const status = await pdfPage.getAttribute("data-render-status").catch(() => null);
          defects.push(`${index + 1}쪽 렌더 상태가 ready가 아님: ${status || "없음"}`);
          continue;
        }
        const canvas = pdfPage.getByTestId("matchup-pdf-canvas");
        const canvasState = await canvas.evaluate((element) => ({
          width: element.width,
          height: element.height,
          visualWidth: element.getBoundingClientRect().width,
        })).catch(() => ({ width: 0, height: 0, visualWidth: 0 }));
        if (canvasState.width < 1 || canvasState.height < 1) defects.push(`${index + 1}쪽 canvas가 비어 있음`);
        if (canvasState.visualWidth > viewport.width + 1) defects.push(`${index + 1}쪽이 화면보다 넓음: ${canvasState.visualWidth}px`);
      }
    }
  }
  if (bodyText.trim().length < 20) defects.push(`본문이 비어 있음 (${bodyText.trim().length}자)`);
  if (/application error|chunkloaderror|페이지를 표시할 수 없습니다/i.test(bodyText)) defects.push("치명적 오류 문구 노출");
  if (/[.!?。！？]\s+[,·]/.test(bodyText)) defects.push("문장부호 뒤에 불필요한 쉼표가 노출됨");
  for (const match of bodyText.matchAll(/(^|[^0-9])(\d{1,2})\/(\d{1,2})\s*개강/g)) {
    const month = Number(match[2]);
    const day = Number(match[3]);
    const opening = new Date(new Date().getFullYear(), month - 1, day, 23, 59, 59, 999);
    if (opening.getMonth() === month - 1 && opening.getDate() === day && opening < new Date()) {
      defects.push(`이미 지난 개강일 노출: ${month}/${day} 개강`);
    }
  }

  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const brokenImages = Array.from(document.images)
      .filter((image) => {
        const style = getComputedStyle(image);
        const rect = image.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1 && image.complete && image.naturalWidth === 0;
      })
      .map((image) => image.currentSrc || image.src || image.alt || "unknown");
    const clippedControls = Array.from(document.querySelectorAll<HTMLElement>("a,button,input,select,textarea"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0 && rect.width > 1 && rect.height > 1 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .map((element) => `${element.tagName.toLowerCase()}:${(element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 40)}`);
    return {
      viewportWidth: root.clientWidth,
      scrollWidth: Math.max(root.scrollWidth, document.body?.scrollWidth || 0),
      brokenImages,
      clippedControls,
    };
  }).catch(() => ({ viewportWidth: 0, scrollWidth: 0, brokenImages: ["geometry evaluation failed"], clippedControls: [] }));

  if (geometry.scrollWidth > geometry.viewportWidth + 1) defects.push(`가로 넘침 ${geometry.scrollWidth}px > ${geometry.viewportWidth}px`);
  if (geometry.brokenImages.length) defects.push(`깨진 이미지: ${geometry.brokenImages.join(", ")}`);
  if (geometry.clippedControls.length) defects.push(`화면 밖 조작 요소: ${geometry.clippedControls.join(", ")}`);

  await page.screenshot({
    path: join(screenshotDir, `${String(viewport.width)}x${String(viewport.height)}-${slug(route.path)}.png`),
    fullPage: true,
  }).catch((error) => defects.push(`스크린샷 실패: ${String(error)}`));

  return defects.map((defect) => `[${viewport.name}] ${route.name} (${route.path}) — ${defect}`);
}

test.describe("tchul 공개 홈페이지 전체 방문 동선", () => {
  test("지난 개강일을 지운 공개 문구에 불필요한 쉼표를 남기지 않는다", () => {
    const copy = resolvePublicProgramCopy({
      title: "통합과학 내신대비 연합반 (월)",
      description: "PM 6:00-9:00 강의 + ~9:30 클리닉. 5/11 개강, 6+1(직보) 회차 구성.",
      badge: "5/11 개강",
    }, new Date("2026-08-05T12:00:00+09:00"));

    expect(copy?.badge).toBe("개강 일정 문의");
    expect(copy?.description).toBe("PM 6:00-9:00 강의 + ~9:30 클리닉. 6+1(직보) 회차 구성.");
  });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem("tenant_code", "tchul");
      sessionStorage.setItem("tenantCode", "tchul");
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} ${viewport.width}x${viewport.height} 전체 route 누적 감사`, async ({ browser, request }) => {
      const screenshotDir = join(ARTIFACT_DIR, "screenshots", viewport.name);
      await mkdir(screenshotDir, { recursive: true });
      const routes = await buildRouteInventory(request);
      const defects: string[] = [];

      for (const route of routes) {
        const routeContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        await routeContext.addInitScript(() => {
          localStorage.setItem("tenant_code", "tchul");
          sessionStorage.setItem("tenantCode", "tchul");
        });
        const routePage = await routeContext.newPage();
        const strict = attachStrictBrowserGuards(routePage);
        try {
          defects.push(...await auditRoute(routePage, route, viewport, screenshotDir));
          try {
            strict.assertZeroDefects();
          } catch (error) {
            defects.push(`[${viewport.name}] ${route.name} (${route.path}) — ${String(error)}`);
          }
        } finally {
          await routeContext.close();
        }
      }

      await test.info().attach("route-inventory", {
        body: Buffer.from(routes.map((route) => `${route.name}\t${route.path}`).join("\n")),
        contentType: "text/plain",
      });
      expect(defects, defects.join("\n")).toEqual([]);
    });
  }

  test("모바일 핵심 동선은 카드 전체와 메뉴로 자연스럽게 이어진다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let landingPublicRequests = 0;
    page.on("request", (request) => {
      if (/\/api\/v1\/core\/landing\/public\/(?:\?|$)/.test(request.url())) landingPublicRequests += 1;
    });
    await page.goto(`${BASE_URL}/landing`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    const firstPreview = page.locator('a[href^="/landing/matchup-board/"] img').first();
    await expect(firstPreview).toBeAttached();
    await firstPreview.dispatchEvent("error");
    await expect(page.getByText("매치업 자료").first()).toBeVisible();

    const firstMatchup = page.locator('a[href^="/landing/matchup-board/"]').first();
    await expect(firstMatchup).toBeVisible();
    const cardBox = await firstMatchup.boundingBox();
    expect(cardBox?.width || 0).toBeGreaterThan(280);
    await firstMatchup.click();
    await expect(page).toHaveURL(/\/landing\/matchup-board\/\d+$/);
    expect(landingPublicRequests, "SPA 상세 이동에서 공개 랜딩 설정을 다시 요청하지 않아야 함").toBe(1);

    await page.goto(`${BASE_URL}/landing`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("landing-nav-burger").click();
    const menu = page.getByRole("dialog", { name: "전체 메뉴" });
    await expect(menu).toBeVisible();
    await menu.getByTestId("landing-nav-item-about-about_page").click();
    await expect(page).toHaveURL(/\/landing\/about$/);

    await page.goto(`${BASE_URL}/landing/board`, { waitUntil: "domcontentloaded" });
    const lastCategory = page.getByTestId("landing-board-cat-other");
    await expect(lastCategory).toBeVisible();
    const categoryBox = await lastCategory.boundingBox();
    expect(categoryBox?.x || 0).toBeGreaterThanOrEqual(0);
    expect((categoryBox?.x || 0) + (categoryBox?.width || 9999)).toBeLessThanOrEqual(390);
  });
});
