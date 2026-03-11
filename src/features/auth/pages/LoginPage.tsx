// 통합 로그인 페이지 — 테넌트별 테마는 data-tenant + themes/*.css 로 적용
import { useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import {
  getTenantCodeFromHostname,
  getTenantIdFromCode,
  getTenantBranding,
  resolveTenantCode,
} from "@/shared/tenant";
import CommonLogoIcon from "@/features/auth/assets/CommonLogoIcon";
import SignupModal from "./SignupModal";
import PasswordResetModal from "./PasswordResetModal";
import "@/features/auth/themes/tchul.css";
import "@/features/auth/themes/limglish.css";
import "@/features/auth/themes/hakwonplus.css";
import "@/features/auth/themes/ymath.css";
import "@/features/auth/themes/sswe.css";
import styles from "./LoginPage.module.css";

/** 테넌트 코드 결정: URL param > hostname > storage/env > program */
function useTenantCode(programTenantCode: string | undefined): string | null {
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();
  if (paramCode) return paramCode;
  const fromHost = getTenantCodeFromHostname();
  if (fromHost.ok) return fromHost.code;
  const resolved = resolveTenantCode();
  if (resolved.ok) return resolved.code;
  return programTenantCode ?? null;
}

export default function LoginPage() {
  useDocumentTitle();

  const { program, isLoading } = useProgram();
  const { tenantCode: paramCode } = useParams<{ tenantCode?: string }>();

  const tenantCode = useTenantCode(program?.tenantCode);
  const tenantId = tenantCode ? getTenantIdFromCode(tenantCode) : null;
  const branding = tenantId ? getTenantBranding(tenantId) : null;

  // 테넌트 도메인 접속 시 /login/code → /login 리다이렉트 (URL 깔끔하게)
  const fromHost = getTenantCodeFromHostname();
  if (paramCode && fromHost.ok) {
    const hostTenantId = getTenantIdFromCode(fromHost.code);
    const paramTenantId = getTenantIdFromCode(paramCode);
    if (hostTenantId === paramTenantId) {
      return <Navigate to="/login" replace />;
    }
  }

  // program 로딩 완료 후 없으면 에러 페이지
  if (!isLoading && !program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  const title = program?.ui_config?.login_title ?? branding?.loginTitle ?? "로그인";
  const subtitle =
    program?.ui_config?.login_subtitle ??
    branding?.loginSubtitle ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  const logoUrl = program?.ui_config?.logo_url ?? branding?.logoUrl;

  // data-tenant: 테넌트 코드 그대로 사용 (themes/*.css selector 매칭)
  const themeAttr = tenantCode ?? "tchul";

  const [formExpanded, setFormExpanded] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [showPwReset, setShowPwReset] = useState(false);

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await login(username, password);
      await refreshMe();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "아이디 또는 비밀번호를 확인해주세요.");
      setPending(false);
    }
  }

  return (
    <div data-app="auth" data-tenant={themeAttr} className={styles.root}>
      <div className={styles.center}>
        {logoUrl ? (
          <img src={logoUrl} alt={title} className={styles.logo} />
        ) : (
          <CommonLogoIcon height={64} className={styles.logo} />
        )}
        <div className={styles.typography}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {!formExpanded ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setFormExpanded(true)}
          >
            로그인
          </button>
        ) : (
          <form onSubmit={onSubmit} className={styles.form} aria-label="로그인 폼">
            <input
              className={styles.input}
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" className={styles.btnPrimary} disabled={pending}>
              {pending ? "로그인 중..." : "로그인"}
            </button>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.links}>
              <button type="button" className={styles.link} onClick={() => setShowSignup(true)}>
                회원가입
              </button>
              <span style={{ color: "var(--auth-text-muted)" }}>|</span>
              <button type="button" className={styles.link} onClick={() => setShowPwReset(true)}>
                비밀번호 찾기
              </button>
            </div>
          </form>
        )}
      </div>

      <SignupModal open={showSignup} onClose={() => setShowSignup(false)} />
      <PasswordResetModal open={showPwReset} onClose={() => setShowPwReset(false)} />
    </div>
  );
}
