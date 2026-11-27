import PublicBrandLink from "@/shared/ui/PublicBrandLink";
// 통합 로그인 페이지 — 테넌트별 테마는 data-tenant + themes/*.css 로 적용
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate, Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { InvalidLoginCredentialsError, login } from "@/auth/api/auth.api";
import type { AccountRecoveryMode } from "@/auth/api/recovery.api";
import useAuth from "@/auth/hooks/useAuth";
import { consumeReturnPath } from "@/shared/api/axios";
import {
  getSessionItem,
  removeSessionItem,
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
import "@/auth/themes/jeongseongwon-lab.css";
import "@/auth/themes/clean-decorations.css";
import styles from "./LoginPage.module.css";
import {
  clearStaffClockInChoicePending,
  markStaffClockInChoicePending,
} from "@/features/staff-clock/promptSession";

const BRANDED_LOGIN_SCENES = new Set(["hakwonplus", "movementhui", "godmin"]);

type LoginError = { message: string; field?: "username" | "password" | "credentials" };

export default function LoginPage() {
  useDocumentTitle();
  useFavicon();

  const { program, isLoading, error: programError } = useProgram();
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();

  // ── hooks는 조건부 return 전에 모두 호출 (Rules of Hooks) ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<AccountRecoveryMode>("password");
  const [hasLanding, setHasLanding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [sessionExpired] = useState(() => getSessionItem("session_expired") === "1");
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
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
    return <Navigate to="/login" replace />;
  }

  // On a canonical host the path was normalized above. A local preview may select its tenant by path.
  let tenantCode = paramCode || (fromHost.ok ? fromHost.code : null);
  if (!tenantCode) {
    const resolved = resolveTenantCode();
    tenantCode = resolved.ok ? resolved.code : program.tenantCode ?? null;
  }

  // 테넌트 1/9999도 /login 페이지 정상 사용 (프로모 리다이렉트 제거)
  const tenantId = tenantCode ? getTenantIdFromCode(tenantCode) : null;
  const branding = tenantId ? getTenantBranding(tenantId) : null;
  const studentSelfRegistrationEnabled = tenantId
    ? getTenantDefById(tenantId)?.studentSelfRegistrationEnabled !== false
    : true;

  const title = program?.ui_config?.login_title || branding?.loginTitle || "로그인";
  const logoUrl = program?.ui_config?.logo_url || branding?.logoUrl;

  // data-tenant: 테넌트 코드 그대로 사용 (themes/*.css selector 매칭)
  const themeAttr = tenantCode ?? "tchul";
  const isHakwonplus = themeAttr === "hakwonplus";
  const publicHome = isHakwonplus || tenantCode === "9999" ? "/promo"
    : hasLanding || tenantCode === "godmin" ? "/landing"
    : window.location.pathname;
  const fieldLabelClass = isHakwonplus ? styles.fieldLabel : styles.srOnly;
  const hasBrandedScene = BRANDED_LOGIN_SCENES.has(themeAttr);
  const isJeongseongwon = themeAttr === "jeongseongwon-lab";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!username.trim()) {
      setError({ field: "username", message: "아이디 또는 학부모 휴대폰 번호를 입력해 주세요." });
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setError({ field: "password", message: "비밀번호를 입력해 주세요." });
      passwordRef.current?.focus();
      return;
    }
    const focusAtSubmit = document.activeElement;
    const submitButton = e.currentTarget.querySelector('button[type="submit"]');
    setPending(true);
    setError(null);
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
      const credentials = e instanceof InvalidLoginCredentialsError;
      setError({
        message: e instanceof Error ? e.message : "아이디 또는 비밀번호를 확인해주세요.",
        field: credentials ? "credentials" : undefined,
      });
      const passwordInput = passwordRef.current;
      // Respect edits or navigation made while the request was in flight.
      if (credentials && passwordInput && passwordInput.value === password && usernameRef.current?.value === username
        && document.activeElement === focusAtSubmit && (focusAtSubmit === submitButton || focusAtSubmit === passwordInput)) {
        passwordInput.focus();
        passwordInput.select();
      }
      setPending(false);
    }
  }

  function openRecovery(mode: AccountRecoveryMode) {
    setRecoveryMode(mode);
    setShowRecovery(true);
  }

  return (
    <div data-app="auth" data-tenant={themeAttr} className={styles.root}>
      {hasBrandedScene && !isHakwonplus && (
        <div className={styles.ambient} data-auth-part="ambient" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <main className={styles.center} data-auth-part="card">
        <section className={styles.brandStage} data-auth-part="brand-stage">
          <PublicBrandLink to={publicHome} aria-label={title + " 홈"} className={styles.brandArtwork} data-auth-part="brand-artwork">
            {logoUrl ? (
              <img src={logoUrl} alt="" className={styles.logo} />
            ) : (
              <CommonLogoIcon height={64} className={styles.logo} />
            )}
            <div className={isHakwonplus ? styles.srOnly : styles.typography}>
              <h1 className={styles.title}>{title}</h1>
            </div>
          </PublicBrandLink>
          {isJeongseongwon && <span data-auth-part="domain">{branding?.loginSubtitle}</span>}
        </section>
        <section className={styles.loginPanel} data-auth-part="login-panel">
          {(hasBrandedScene || isJeongseongwon) && (
            <div className={styles.loginIntro} data-auth-part="login-intro">
              <h2>로그인</h2>
              {hasBrandedScene && !isHakwonplus && <p>아이디와 비밀번호를 입력해주세요.</p>}
            </div>
          )}
          <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="로그인 폼">
            <label htmlFor="login-username" className={fieldLabelClass}>
              아이디 또는 학부모 휴대폰 번호
            </label>
            <input
              id="login-username"
              ref={usernameRef}
              className={styles.input}
              placeholder={isHakwonplus ? undefined : "아이디 또는 학부모 휴대폰 번호"}
              name="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error?.field === "username" || error?.field === "credentials") setError(null);
              }}
              required
              aria-invalid={error?.field === "username" || undefined}
              aria-describedby={error?.field === "username" || error?.field === "credentials" ? "login-feedback" : undefined}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-testid="login-username"
            />
            <label htmlFor="login-password" className={fieldLabelClass}>비밀번호</label>
            <div className={styles.passwordWrap}>
              <input
                id="login-password"
                ref={passwordRef}
                className={styles.input}
                type={showPassword ? "text" : "password"}
                placeholder={isHakwonplus ? undefined : "비밀번호"}
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error?.field === "password" || error?.field === "credentials") setError(null);
                }}
                required
                aria-invalid={error?.field === "password" || undefined}
                aria-describedby={error?.field === "password" || error?.field === "credentials" ? "login-feedback" : undefined}
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
            {(error || isHakwonplus) && (
              <div id="login-feedback" data-auth-part="login-feedback" className={error ? styles.error : undefined} role={error ? "alert" : undefined}>
                {error?.message}
              </div>
            )}
            <button type="submit" className={styles.btnPrimary} aria-disabled={pending || undefined} data-testid="login-submit">
              {pending ? "로그인 중..." : "로그인"}
            </button>
            <div className={styles.links} data-auth-part="account-links">
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
        {isJeongseongwon && (
          <>
            <a href="https://hakwonplus.com/promo/guide?role=student" className={styles.legalLink}>사용 가이드</a>
            <span className={styles.legalSep} aria-hidden="true">|</span>
          </>
        )}
        <Link to="/terms" className={styles.legalLink}>이용약관</Link>
        <span className={styles.legalSep}>|</span>
        <Link to="/privacy" className={styles.legalLink}>개인정보처리방침</Link>
      </footer>
    </div>
  );
}
