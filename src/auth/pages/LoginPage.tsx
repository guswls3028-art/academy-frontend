// 통합 로그인 페이지 — 테넌트별 테마는 data-tenant + themes/*.css 로 적용
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, Navigate, Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { enterDawonDemo, login } from "@/auth/api/auth.api";
import type { AccountRecoveryMode } from "@/auth/api/recovery.api";
import useAuth from "@/auth/hooks/useAuth";
import { consumeReturnPath } from "@/shared/api/axios";
import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import {
  getTenantCodeFromHostname,
  getTenantDefById,
  getTenantIdFromCode,
  getTenantBranding,
  resolveTenantCode,
} from "@/shared/tenant";
import CommonLogoIcon from "@/auth/assets/CommonLogoIcon";
import DawonCounselEntry from "./DawonCounselEntry";
import { fetchLandingHasPublished } from "@/landing/api";
import { useFavicon } from "@/shared/hooks/useFavicon";
import SignupModal from "./SignupModal";
import AccountRecoveryModal from "./AccountRecoveryModal";
import TenantRequiredPage from "./TenantRequiredPage";
import "@/auth/themes/tchul.css";
import "@/auth/themes/limglish.css";
import "@/auth/themes/hakwonplus.css";
import "@/auth/themes/ymath.css";
import "@/auth/themes/sswe.css";
import "@/auth/themes/dnb.css";
import "@/auth/themes/movementhui.css";
import "@/auth/themes/godmin.css";
import "@/auth/themes/dawon.css";
import "@/auth/themes/clean-decorations.css";
import styles from "./LoginPage.module.css";
import {
  clearStaffClockInChoicePending,
  markStaffClockInChoicePending,
} from "@/features/staff-clock/promptSession";

const BRANDED_LOGIN_SCENES = new Set(["hakwonplus", "movementhui", "godmin"]);

function counselEntrySearch(params: URLSearchParams): string | null {
  const panel = params.get("panel");
  if (params.get("demo") !== "guardian" || params.get("view") !== "counsel" || (panel !== "form" && panel !== "history")) return null;
  const query = new URLSearchParams({ demo: "guardian", view: "counsel", panel });
  const date = params.get("date");
  if (panel === "history" && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query.set("date", date);
  return "?" + query.toString();
}

function isDawonDemoSearch(tenantCode: string | null, search: string) {
  const params = new URLSearchParams(search);
  if (tenantCode !== "dawon") return "";
  if (["admin", "teacher"].includes(params.get("demo") ?? "")) return `?demo=${params.get("demo")}`;
  if (params.get("demo") === "guardian") return counselEntrySearch(params) ?? "?demo=guardian&view=counsel";
  if (params.get("demo") !== "student") return "";
  const view = params.get("view");
  const session = params.get("session") ?? "";
  if (view === "video" && /^[1-9]\d{0,9}$/.test(session)) return `?demo=student&view=video&session=${session}`;
  return view === "exams" || view === "school-report" || view === "clinic"
    ? `?demo=student&view=${view}` : "?demo=student";
}

/**
 * 테넌트 코드 결정 우선순위: hostname > URL param > storage/env > program
 * - hostname 결정 가능 시: 백엔드가 host 기반 SSOT로 인증하므로 화면 브랜딩도 host와 맞춰야 일관성 유지
 *   (param이 host와 다르면 충돌. 충돌 처리는 컴포넌트 본문에서 정규 경로로 리다이렉트)
 * - hostname 결정 불가(localhost / 프리뷰)인 경우에만 URL param 사용
 */
function useTenantCode(programTenantCode: string | undefined): string | null {
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();
  const hostname = window.location.hostname.trim().toLowerCase();
  const isLocalOrPreview =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".pages.dev") ||
    hostname.endsWith(".trycloudflare.com");
  if (isLocalOrPreview && paramCode) return paramCode;

  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) return fromHost.code;
  if (paramCode) return paramCode;
  const resolved = resolveTenantCode();
  if (resolved.ok) return resolved.code;
  return programTenantCode ?? null;
}

export default function LoginPage() {
  useDocumentTitle();
  useFavicon();

  const { program, isLoading, error: programError } = useProgram();
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();
  const tenantCode = useTenantCode(program?.tenantCode);

  // ── hooks는 조건부 return 전에 모두 호출 (Rules of Hooks) ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<AccountRecoveryMode>("password");
  const [hasLanding, setHasLanding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [sessionExpired] = useState(() => getSessionItem("session_expired") === "1");
  const usernameRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshMe } = useAuth();

  // 진입 시 username에 자동 포커스
  useEffect(() => {
    if (!isLoading) usernameRef.current?.focus();
  }, [isLoading]);

  // 랜딩 페이지 존재 여부 체크 (홈 버튼 표시용)
  // 테넌트별 분기 없이 fetchLandingHasPublished 결과로만 판정 — 게시된 랜딩이 있으면 버튼 노출
  useEffect(() => {
    if (isLoading || !program) return;
    fetchLandingHasPublished()
      .then((has) => setHasLanding(has))
      .catch(() => {});
  }, [isLoading, program]);

  // program 로딩 중이면 아무것도 렌더하지 않음 (기본값→실제값 플래시 방지)
  if (isLoading) return null;

  // 연결 복구는 학원 정보에 사용한 로그인 주소에서 다시 시작한다.
  if (programError && !program) {
    return <TenantRequiredPage retryCurrentPage />;
  }

  // program 로딩 완료 후 없으면 에러 페이지
  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  // 테넌트 1/9999도 /login 페이지 정상 사용 (프로모 리다이렉트 제거)
  const tenantId = tenantCode ? getTenantIdFromCode(tenantCode) : null;
  const branding = tenantId ? getTenantBranding(tenantId) : null;
  const studentSelfRegistrationEnabled = tenantId
    ? getTenantDefById(tenantId)?.studentSelfRegistrationEnabled !== false
    : true;

  // 테넌트 도메인 접속 시 /login/code → /login 리다이렉트.
  // 같은 테넌트면 URL을 깔끔하게, 다른 테넌트면 host 기준으로 강제 정규화 (브랜딩-인증 불일치 방지).
  const fromHost = getTenantCodeFromHostname();
  const hostname = window.location.hostname.trim().toLowerCase();
  const isLocalOrPreview =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".pages.dev") ||
    hostname.endsWith(".trycloudflare.com");
  if (paramCode && fromHost.ok && !isLocalOrPreview) {
    return <Navigate to={{ pathname: "/login", search: isDawonDemoSearch(tenantCode, location.search) }} replace />;
  }

  const title = program?.ui_config?.login_title || branding?.loginTitle || "로그인";
  const logoUrl = program?.ui_config?.logo_url || branding?.logoUrl;

  // data-tenant: 테넌트 코드 그대로 사용 (themes/*.css selector 매칭)
  const themeAttr = tenantCode ?? "tchul";
  const hasBrandedScene = BRANDED_LOGIN_SCENES.has(themeAttr);
  const isDawonDemo = tenantCode === "dawon";
  const learnerPath = getSessionItem("session_return_path") ?? "";
  const reportPath = "/student/submit/school-report";
  const previewSearch = new URLSearchParams(location.search);
  const counselSearch = isDawonDemo && hostname === "demo.hakwonplus.com" ? counselEntrySearch(previewSearch) : null;
  const adminEntry = previewSearch.get("demo") === "admin";
  const staffEntry = adminEntry || previewSearch.get("demo") === "teacher";
  const clinicEntry = !staffEntry && (previewSearch.get("view") === "clinic" || /^\/student\/clinic(?:[/?#]|$)/.test(learnerPath));
  const examReturn = !previewSearch.has("demo") && /^\/student\/exams\/[1-9]\d*\/result(?:\?|$)/.test(learnerPath)
    ? new URL(learnerPath, window.location.origin) : null;
  const parentReportEntry = examReturn?.searchParams.get("preview") === "guardian";
  const guardianEntry = parentReportEntry || previewSearch.get("demo") === "guardian" || (!previewSearch.has("demo") && learnerPath.startsWith("/student/community?tab=counsel"));
  const explicitVideo = previewSearch.get("session") ?? "";
  const videoPath = previewSearch.get("view") === "video" && /^[1-9]\d{0,9}$/.test(explicitVideo)
    ? `/student/video/sessions/${explicitVideo}` : "";
  const nativeVideoEntry = /^\/student\/video\/sessions\/[1-9]\d*\/?$/.test(learnerPath);
  const videoEntry = Boolean(videoPath) || nativeVideoEntry;
  const fromLearnerPage = nativeVideoEntry || /^\/student\/(attendance|clinic|exams|submit\/school-report)(?:[/?#]|$)/.test(learnerPath);
  const learnerEntry = !staffEntry && (fromLearnerPage || previewSearch.get("demo") === "student");
  const reportEntry = previewSearch.get("view") === "school-report" || learnerPath.split(/[?#]/)[0] === reportPath;
  const qrEntry = learnerEntry && !clinicEntry && !videoEntry && !reportEntry && !(previewSearch.get("view") === "exams" || learnerPath.startsWith("/student/exams"));

  async function onDemoEntry() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const role = adminEntry ? "admin" : guardianEntry ? "guardian" : learnerEntry ? "student" : "teacher";
      await enterDawonDemo(role);
      const identity = await refreshMe();
      if (counselSearch && identity?.tenantRole !== "parent") throw new Error("학부모 계정을 확인할 수 없습니다.");
      if (role === "admin" || role === "teacher") {
        setSessionItem("dawon-workspace-role", role);
        removeSessionItem("dawon-room-role");
      } else {
        setSessionItem("dawon-room-role", role);
        removeSessionItem("dawon-workspace-role");
      }
      removeSessionItem("session_expired");
      const returnPath = consumeReturnPath();
      let destination = "/";
      if (role === "admin" || role === "teacher") destination = "/workspace/dashboard";
      else if (videoPath) destination = videoPath;
      else if (examReturn && returnPath === learnerPath) destination = returnPath;
      else if (guardianEntry) {
        const next = new URLSearchParams({ tab: "counsel" });
        if (counselSearch) {
          const intent = new URLSearchParams(counselSearch);
          next.set("panel", intent.get("panel") ?? "form");
          const selectedDay = intent.get("date");
          if (selectedDay) next.set("date", selectedDay);
        }
        destination = "/student/community?" + next.toString();
      } else if (learnerEntry) {
        if (clinicEntry) destination = "/student/clinic";
        else if (!previewSearch.has("view") && fromLearnerPage && returnPath) destination = returnPath;
        else if (qrEntry) destination = "/student/attendance/scan";
        else destination = reportEntry ? reportPath : "/student/exams";
      }
      navigate(destination, { replace: true });
    } catch {
      setError("체험 계정에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await login(username, password);
      const authenticatedUser = await refreshMe();
      if (authenticatedUser?.tenantRole === "staff") {
        markStaffClockInChoicePending();
      } else {
        clearStaffClockInChoicePending();
      }
      removeSessionItem("session_expired");
      const returnPath = consumeReturnPath();
      navigate(returnPath || "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "아이디 또는 비밀번호를 확인해주세요.");
      setPending(false);
    }
  }

  function openRecovery(mode: AccountRecoveryMode) {
    setRecoveryMode(mode);
    setShowRecovery(true);
  }

  if (counselSearch) {
    return <DawonCounselEntry search={counselSearch} pending={pending} error={error} onEnter={onDemoEntry} />;
  }

  return (
    <div data-app="auth" data-tenant={themeAttr} className={styles.root}>
      {hasBrandedScene && (
        <div className={styles.ambient} data-auth-part="ambient" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <main className={styles.center} data-auth-part="card">
        <section className={styles.brandStage} data-auth-part="brand-stage">
          <div className={styles.brandArtwork} data-auth-part="brand-artwork">
            {logoUrl ? (
              <img src={logoUrl} alt={title} className={styles.logo} />
            ) : (
              <CommonLogoIcon height={64} className={styles.logo} />
            )}
            <div className={styles.typography}>
              <h1 className={styles.title}>{title}</h1>
            </div>
          </div>
        </section>
        <section className={styles.loginPanel} data-auth-part="login-panel">
          {hasBrandedScene && (
            <div className={styles.loginIntro} data-auth-part="login-intro">
              <h2>로그인</h2>
              <p>아이디와 비밀번호를 입력해주세요.</p>
            </div>
          )}
          <form onSubmit={onSubmit} className={styles.form} aria-label="로그인 폼">
            {isDawonDemo && (
              <div className={styles.demoEntry}>
                <button type="button" className={styles.btnPrimary} onClick={() => void onDemoEntry()} disabled={pending}>
                  {adminEntry ? "관리자 데모 로그인" : staffEntry ? "선생님 데모 로그인" : parentReportEntry ? "학부모 데모로 성적표 보기" : guardianEntry ? "학부모 데모로 상담 신청" : clinicEntry ? "학생 데모로 클리닉 신청" : videoEntry ? "학생 데모로 수업 영상 보기" : qrEntry ? "학생 데모로 QR 출석" : reportEntry ? "학생 데모로 학교 성적 입력" : learnerEntry ? "학생 데모로 시험 결과 보기" : "데모 계정으로 시작"}
                </button>
                <span>{adminEntry ? "예시 학원의 반 운영, 직원, 시험 결과를 관리합니다." : guardianEntry ? "예시 학부모로 체험합니다." : learnerEntry ? "예시 학생으로 체험합니다." : "선생님 업무는 PC에서 보기를 권장합니다."}</span>
              </div>
            )}
            <label htmlFor="login-username" className={styles.srOnly}>아이디 또는 학부모 휴대폰 번호</label>
            <input
              id="login-username"
              ref={usernameRef}
              className={styles.input}
              placeholder="아이디 또는 학부모 휴대폰 번호"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-testid="login-username"
            />
            <label htmlFor="login-password" className={styles.srOnly}>비밀번호</label>
            <div className={styles.passwordWrap}>
              <input
                id="login-password"
                className={styles.input}
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))}
                onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))}
                onBlur={() => setCapsOn(false)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-testid="login-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            {capsOn && (
              <div className={styles.capsHint} role="status">
                ⚠ Caps Lock이 켜져 있습니다.
              </div>
            )}
            {sessionExpired && (
              <div className={styles.error} role="status">
                세션이 만료되었습니다. 다시 로그인해 주세요.
              </div>
            )}
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="submit" className={styles.btnPrimary} disabled={pending} data-testid="login-submit">
              {pending ? "로그인 중..." : "로그인"}
            </button>
            <div className={styles.links}>
              {(hasLanding || tenantCode === "godmin") && (
                <Link to="/landing" className={styles.link}>
                  홈페이지
                </Link>
              )}
              {studentSelfRegistrationEnabled && (
                <button type="button" className={styles.link} onClick={() => setShowSignup(true)}>
                  회원가입
                </button>
              )}
              <button type="button" className={styles.link} onClick={() => openRecovery("username")}>
                아이디 찾기
              </button>
              <button type="button" className={styles.link} onClick={() => openRecovery("password")}>
                비밀번호 찾기
              </button>
            </div>
          </form>
        </section>
      </main>

      <SignupModal
        open={studentSelfRegistrationEnabled && showSignup}
        onClose={() => setShowSignup(false)}
      />
      <AccountRecoveryModal
        open={showRecovery}
        initialMode={recoveryMode}
        onClose={() => setShowRecovery(false)}
      />

      <footer className={styles.legalFooter}>
        <Link to="/terms" className={styles.legalLink}>이용약관</Link>
        <span className={styles.legalSep}>|</span>
        <Link to="/privacy" className={styles.legalLink}>개인정보처리방침</Link>
      </footer>
    </div>
  );
}
