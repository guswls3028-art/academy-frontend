// PATH: src/core/router/AppRouter.tsx
//
// Suspense fallback / 라우팅 placeholder는 격리된 인라인 style 허용 — 별도 CSS 모듈 추출 비효율.
/* eslint-disable no-restricted-syntax */
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useEffect, useRef } from "react";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import ProtectedRoute from "./ProtectedRoute";
import MobileTeacherRedirect, { prefersAdmin } from "./MobileTeacherRedirect";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";

const StudentRouter = lazy(() => import("@student/app/StudentRouter"));
const TeacherRouter = lazy(() => import("@teacher/app/TeacherRouter"));
import AuthRouter from "./AuthRouter";

import TenantRequiredPage from "@/auth/pages/TenantRequiredPage";
import MaintenancePage from "@admin/domains/maintenance/pages/MaintenancePage";
import { TermsPage, PrivacyPage } from "@admin/domains/legal";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";

const AdminRouter = lazy(() => import("@admin/app/AdminRouter"));
const DevAppRouter = lazy(() => import("@dev/app/DevAppRouter"));
const PromoRouter = lazy(() => import("@promo/app/PromoRouter"));
const PublicLandingPage = lazy(() => import("@/landing/pages/PublicLandingPage"));
const LandingReportDetailPage = lazy(() => import("@/landing/pages/LandingReportDetailPage"));
const LandingReportsListPage = lazy(() => import("@/landing/pages/LandingReportsListPage"));
// 1클릭 공유 토큰 진입 (#67, 2026-05-12) — 학생 로그인 없이 카톡 링크로 PDF 즉시 노출.
const LandingShareReportPage = lazy(() => import("@/landing/pages/LandingShareReportPage"));
const LandingCommunityListPage = lazy(() => import("@/landing/pages/LandingCommunityListPage"));
const LandingCommunityPostPage = lazy(() => import("@/landing/pages/LandingCommunityPostPage"));
const LandingCommunityWritePage = lazy(() => import("@/landing/pages/LandingCommunityWritePage"));
// 신규 외부 공개 커뮤니티 — landing_public 도메인 (2026-05-12).
// family-only LandingCommunity* 와 별개 트랙. 자유게시판 / 수강후기 두 축만.
const LandingBoardPage = lazy(() => import("@/landing/pages/LandingBoardPage"));
const LandingBoardDetailPage = lazy(() => import("@/landing/pages/LandingBoardDetailPage"));
const LandingBoardWritePage = lazy(() => import("@/landing/pages/LandingBoardWritePage"));
const LandingBoardEditPage = lazy(() => import("@/landing/pages/LandingBoardEditPage"));
const LandingReviewsPage = lazy(() => import("@/landing/pages/LandingReviewsPage"));
const LandingReviewDetailPage = lazy(() => import("@/landing/pages/LandingReviewDetailPage"));
const LandingReviewWritePage = lazy(() => import("@/landing/pages/LandingReviewWritePage"));
const LandingScoresListPage = lazy(() => import("@/landing/pages/LandingScoresPage").then(m => ({ default: m.LandingScoresListPage })));
const LandingScoresDetailPage = lazy(() => import("@/landing/pages/LandingScoresPage").then(m => ({ default: m.LandingScoresDetailPage })));
// 매치업 적중보고서 게시판 admin (Phase #69, 2026-05-13) — 학원장만 진입. 사이드바 "수정하기 (학원장)" → 매치업 게시판 관리.
const LandingMatchupBoardAdminPage = lazy(() => import("@/landing/admin/LandingMatchupBoardAdminPage"));
const LandingMatchupBoardPage = lazy(() => import("@/landing/pages/LandingMatchupBoardPage"));
const LandingMatchupBoardDetailPage = lazy(() => import("@/landing/pages/LandingMatchupBoardDetailPage"));
// 학원소개/가이드 dedicated page (Phase #73, 2026-05-13) — 학원장 spec "헤더 메뉴 별로 라우트 구조"
const LandingAboutPage = lazy(() => import("@/landing/pages/LandingAboutPage"));
const LandingGuidePage = lazy(() => import("@/landing/pages/LandingGuidePage"));

function MaintenanceGate({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  if (!enabled) return <Outlet />;

  const p = location.pathname || "";
  if (p.startsWith("/dev") || p.startsWith("/login") || p.startsWith("/promo") || p.startsWith("/maintenance") || p.startsWith("/terms") || p.startsWith("/privacy")) {
    return <Outlet />;
  }

  return <Navigate to="/maintenance" replace />;
}

/** 홍보 테넌트(hakwonplus, 9999)만 /promo 접근 허용. 그 외 테넌트는 / 로 리다이렉트. */
function PromoGuard() {
  const { program, isLoading } = useProgram();
  if (isLoading) return null;
  const tc = program?.tenantCode;
  if (tc === "hakwonplus" || tc === "9999") return <Outlet />;
  return <Navigate to="/" replace />;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { program, isLoading: programLoading } = useProgram();
  const navigate = useNavigate();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (programLoading || !program || isLoading) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;

    // 비로그인: 홍보 테넌트(1번/9999)면 홍보 앱, 그 외 로그인
    if (!user) {
      const tc = program.tenantCode;
      if (tc === "hakwonplus" || tc === "9999") {
        navigate("/promo", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
      return;
    }

    const role = user.tenantRole;

    // 테넌트 1번(hakwonplus) 및 9999번(로컬 개발) owner는 dev_app(개발자 앱)으로 리다이렉트
    if ((program.tenantCode === "hakwonplus" || program.tenantCode === "9999") && role === "owner") {
      navigate("/dev/dashboard", { replace: true });
      return;
    }

    if (role && ["owner", "admin", "teacher", "staff"].includes(role)) {
      // 모바일 + staff역할 → 선생님 앱, standalone이면 이미 의도적 접근
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (isMobile && !isStandalone && !prefersAdmin()) {
        navigate("/teacher", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
      return;
    }

    if (role && ["student", "parent"].includes(role)) {
      navigate("/student", { replace: true });
      return;
    }

    navigate("/login", { replace: true });
  }, [programLoading, program, isLoading, user, navigate]);

  if (programLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  return null;
}

export default function AppRouter() {
  const { program } = useProgram();
  const tenantCode = program?.tenantCode;
  const maintenanceExempt = tenantCode === "hakwonplus" || tenantCode === "9999";
  const maintenanceOn = Boolean(program?.feature_flags?.maintenance_mode) && !maintenanceExempt;

  return (
    <Routes>
      <Route path="/login/*" element={<AuthRouter />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<PromoGuard />}>
        <Route
          path="/promo/*"
          element={
            <Suspense
              fallback={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>
                  불러오는 중…
                </div>
              }
            >
              <PromoRouter />
            </Suspense>
          }
        />
      </Route>
      {/* 공개 랜딩페이지 (인증 불필요, tenant resolved) */}
      <Route
        path="/landing"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <PublicLandingPage />
          </Suspense>
        }
      />
      {/* 적중보고서 갤러리 — 학원장 picker 등록한 모든 보고서 한 페이지 */}
      <Route
        path="/landing/reports"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingReportsListPage />
          </Suspense>
        }
      />
      {/* 적중보고서 상세 — 학원장 picker 등록 ID만 (backend 게이트). 사이트 내부 라우트 유지로 학원 정체성 보존. */}
      <Route
        path="/landing/reports/:reportId"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingReportDetailPage />
          </Suspense>
        }
      />
      {/* 1클릭 공유 — 선생이 카톡으로 학생/학부모에게 보내는 token URL. 로그인 X. */}
      <Route
        path="/landing/share/:token"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingShareReportPage />
          </Suspense>
        }
      />
      {/* 랜딩 커뮤니티 게시판 — backend community 도메인 연동. 권한별 노출 + 10/page 페이지네이션. */}
      <Route
        path="/landing/community/:boardType"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingCommunityListPage />
          </Suspense>
        }
      />
      {/* 글 상세 — 별도 페이지 이동 없이 본문→액션→댓글까지 자연 스크롤. 학원장 spec(2026-05-11). */}
      <Route
        path="/landing/community/:boardType/posts/:postId"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingCommunityPostPage />
          </Suspense>
        }
      />
      {/* 글쓰기 — 권한별 노출 board_type 다름(학생: board/qna, staff: 전체). 학부모 차단. */}
      <Route
        path="/landing/community/:boardType/write"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingCommunityWritePage />
          </Suspense>
        }
      />
      {/* 신규: 외부 공개 자유게시판 — 비로그인 OK + 학원 family 작성 + 학원장 모더레이션. */}
      <Route
        path="/landing/board"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingBoardPage />
          </Suspense>
        }
      />
      <Route
        path="/landing/board/write"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingBoardWritePage />
          </Suspense>
        }
      />
      <Route
        path="/landing/board/:postId"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingBoardDetailPage />
          </Suspense>
        }
      />
      {/* 글 수정 — 본인 또는 staff (Phase #72, 2026-05-13 audit P0 fix) */}
      <Route
        path="/landing/board/:postId/edit"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingBoardEditPage />
          </Suspense>
        }
      />
      {/* 신규: 외부 공개 수강후기 — 평점 + 학년/과목/사진 + 학원장 승인 워크플로우. */}
      <Route
        path="/landing/reviews"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingReviewsPage />
          </Suspense>
        }
      />
      <Route
        path="/landing/reviews/write"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingReviewWritePage />
          </Suspense>
        }
      />
      <Route
        path="/landing/reviews/:reviewId"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingReviewDetailPage />
          </Suspense>
        }
      />
      {/* 신규: 성적 통계 랜딩 홍보 (Phase #13) — 학원장 1버튼 publish, 외부 학부모 read OK */}
      <Route
        path="/landing/scores"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingScoresListPage />
          </Suspense>
        }
      />
      <Route
        path="/landing/scores/:id"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingScoresDetailPage />
          </Suspense>
        }
      />
      {/* 학원소개 / 가이드 dedicated page (Phase #73, 2026-05-13 — 학원장 spec) */}
      <Route
        path="/landing/about"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingAboutPage />
          </Suspense>
        }
      />
      <Route
        path="/landing/guide"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingGuidePage />
          </Suspense>
        }
      />
      {/* 매치업 적중보고서 공개 게시판 — 외부 학부모 read OK (window 안에서만 PDF 노출). */}
      <Route
        path="/landing/matchup-board"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingMatchupBoardPage />
          </Suspense>
        }
      />
      {/* 단일 게시물 외부 공개 링크 — 박철T 학원장 spec (Phase #74, 2026-05-13):
          "매치업만 볼 수 있는 링크" — 학원 list X, PDF 1개만 dedicated URL. */}
      <Route
        path="/landing/matchup-board/:id"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingMatchupBoardDetailPage />
          </Suspense>
        }
      />
      {/* 매치업 적중보고서 게시판 admin — 학원장 전용 CRUD (Phase #69, 2026-05-13). 본 페이지 자체에서 owner 검증. */}
      <Route
        path="/landing/admin/matchup-board"
        element={
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><span style={{ color: "var(--color-text-tertiary, #666)", fontSize: "var(--text-sm, 13px)" }}>불러오는 중…</span></div>}>
            <LandingMatchupBoardAdminPage />
          </Suspense>
        }
      />
      <Route path="/maintenance" element={<MaintenancePage />} />

      <Route
        path="/error/tenant-required"
        element={<TenantRequiredPage />}
      />

      <Route element={<MaintenanceGate enabled={maintenanceOn} />}>
        <Route
          element={
            <ProtectedRoute allow={["owner"]} tenantOnly={["hakwonplus", "9999"]} />
          }
        >
          <Route
            path="/dev/*"
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 200,
                        color: "var(--color-text-tertiary, #666)",
                        fontSize: "var(--text-sm, 13px)",
                      }}
                    >
                      불러오는 중…
                    </div>
                  }
                >
                  <DevAppRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>

        <Route path="/" element={<RootRedirect />} />

        <Route element={<ProtectedRoute allow={["student", "parent"]} />}>
          <Route
            path="/student/*"
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 200,
                        color: "var(--color-text-tertiary, #666)",
                        fontSize: "var(--text-sm, 13px)",
                      }}
                    >
                      불러오는 중…
                    </div>
                  }
                >
                  <StudentRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allow={["owner", "admin", "teacher", "staff"]} />
          }
        >
          <Route element={<MobileTeacherRedirect />}>
            <Route
              path="/admin/*"
              element={
                <ErrorBoundary>
                  <Suspense
                    fallback={
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 200,
                          color: "#666",
                          fontSize: 14,
                        }}
                      >
                        불러오는 중…
                      </div>
                    }
                  >
                    <AdminRouter />
                  </Suspense>
                </ErrorBoundary>
              }
            />
          </Route>
          <Route
            path="/teacher/*"
            element={
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 200,
                        color: "#666",
                        fontSize: 14,
                      }}
                    >
                      불러오는 중…
                    </div>
                  }
                >
                  <TeacherRouter />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
