// 통합 로그인 페이지 — 테넌트별 테마는 data-tenant + themes/*.css 로 적용
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Navigate, Link } from "react-router-dom";
import { login } from "@/auth/api/auth.api";
import useAuth from "@/auth/hooks/useAuth";
import { consumeReturnPath } from "@/shared/api/axios";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import {
  getTenantCodeFromHostname,
  getTenantIdFromCode,
  getTenantBranding,
  resolveTenantCode,
} from "@/shared/tenant";
import CommonLogoIcon from "@/auth/assets/CommonLogoIcon";
import { fetchLandingHasPublished } from "@/landing/api";
import { useFavicon } from "@/shared/hooks/useFavicon";
import SignupModal from "./SignupModal";
import PasswordResetModal from "./PasswordResetModal";
import "@/auth/themes/tchul.css";
import "@/auth/themes/limglish.css";
import "@/auth/themes/hakwonplus.css";
import "@/auth/themes/ymath.css";
import "@/auth/themes/sswe.css";
import "@/auth/themes/dnb.css";
import styles from "./LoginPage.module.css";

/**
 * 테넌트 코드 결정 우선순위: hostname > URL param > storage/env > program
 * - hostname 결정 가능 시: 백엔드가 host 기반 SSOT로 인증하므로 화면 브랜딩도 host와 맞춰야 일관성 유지
 *   (param이 host와 다르면 충돌. 충돌 처리는 컴포넌트 본문에서 정규 경로로 리다이렉트)
 * - hostname 결정 불가(localhost / 프리뷰)인 경우에만 URL param 사용
 */
function useTenantCode(programTenantCode: string | undefined): string | null {
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();
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

  const { program, isLoading } = useProgram();
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();
  const tenantCode = useTenantCode(program?.tenantCode);

  // ── hooks는 조건부 return 전에 모두 호출 (Rules of Hooks) ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [showPwReset, setShowPwReset] = useState(false);
  const [hasLanding, setHasLanding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  // 진입 시 username에 자동 포커스
  useEffect(() => {
    if (!isLoading) usernameRef.current?.focus();
  }, [isLoading]);

  // 랜딩 페이지 존재 여부 체크 (홈 버튼 표시용)
  useEffect(() => {
    if (isLoading || !program) return;
    const tc = program.tenantCode;
    if (tc === "hakwonplus" || tc === "9999") return;
    fetchLandingHasPublished()
      .then((has) => setHasLanding(has))
      .catch(() => {});
  }, [isLoading, program]);

  // program 로딩 중이면 아무것도 렌더하지 않음 (기본값→실제값 플래시 방지)
  if (isLoading) return null;

  // program 로딩 완료 후 없으면 에러 페이지
  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  // 테넌트 1/9999도 /login 페이지 정상 사용 (프로모 리다이렉트 제거)
  const tenantId = tenantCode ? getTenantIdFromCode(tenantCode) : null;
  const branding = tenantId ? getTenantBranding(tenantId) : null;

  // 테넌트 도메인 접속 시 /login/code → /login 리다이렉트.
  // 같은 테넌트면 URL을 깔끔하게, 다른 테넌트면 host 기준으로 강제 정규화 (브랜딩-인증 불일치 방지).
  const fromHost = getTenantCodeFromHostname();
  if (paramCode && fromHost.ok) {
    return <Navigate to="/login" replace />;
  }

  const title = branding?.loginTitle ?? program?.ui_config?.login_title ?? "로그인";
  const logoUrl = branding?.logoUrl ?? program?.ui_config?.logo_url;

  // data-tenant: 테넌트 코드 그대로 사용 (themes/*.css selector 매칭)
  const themeAttr = tenantCode ?? "tchul";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await login(username, password);
      await refreshMe();
      const returnPath = consumeReturnPath();
      navigate(returnPath || "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "아이디 또는 비밀번호를 확인해주세요.");
      setPending(false);
    }
  }

  return (
    <div data-app="auth" data-tenant={themeAttr} className={styles.root}>
      {hasLanding && (
        <Link to="/landing" className={styles.homeBtn} aria-label="홈페이지">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10L10 3L17 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 8.5V16C5 16.2761 5.22386 16.5 5.5 16.5H8.5V12.5C8.5 12.2239 8.72386 12 9 12H11C11.2761 12 11.5 12.2239 11.5 12.5V16.5H14.5C14.7761 16.5 15 16.2761 15 16V8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          홈페이지
        </Link>
      )}
      <div className={styles.center}>
        {logoUrl ? (
          <img src={logoUrl} alt={title} className={styles.logo} />
        ) : (
          <CommonLogoIcon height={64} className={styles.logo} />
        )}
        <div className={styles.typography}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <form onSubmit={onSubmit} className={styles.form} aria-label="로그인 폼">
          <label htmlFor="login-username" className={styles.srOnly}>아이디</label>
          <input
            id="login-username"
            ref={usernameRef}
            className={styles.input}
            placeholder="아이디"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
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
              data-testid="login-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {capsOn && (
            <div className={styles.capsHint} role="status">
              ⚠ Caps Lock이 켜져 있습니다.
            </div>
          )}
          {error && <div className={styles.error} role="alert">{error}</div>}
          <button type="submit" className={styles.btnPrimary} disabled={pending} data-testid="login-submit">
            {pending ? "로그인 중..." : "로그인"}
          </button>
          <div className={styles.links}>
            <button type="button" className={styles.link} onClick={() => setShowSignup(true)}>
              회원가입
            </button>
            <span style={{ color: "var(--auth-border, #d1d5db)", fontSize: "0.75rem" }}>|</span>
            <button type="button" className={styles.link} onClick={() => setShowPwReset(true)}>
              비밀번호 찾기
            </button>
          </div>
        </form>
      </div>

      <SignupModal open={showSignup} onClose={() => setShowSignup(false)} />
      <PasswordResetModal open={showPwReset} onClose={() => setShowPwReset(false)} />

      <footer className={styles.legalFooter}>
        <Link to="/terms" className={styles.legalLink}>이용약관</Link>
        <span className={styles.legalSep}>|</span>
        <Link to="/privacy" className={styles.legalLink}>개인정보처리방침</Link>
      </footer>
    </div>
  );
}
