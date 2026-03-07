// PATH: src/features/auth/pages/login/EnhancedCommonLoginPage.tsx
// 테넌트 1, 3, 4, 9999 전용 — 로고 크기, 타이포그래피, 클릭 시 입력폼 (2번 제외)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import {
  getTenantCodeFromHostname,
  getTenantIdFromCode,
  getTenantBranding,
} from "@/shared/tenant";
import {
  submitRegistrationRequest,
  requestPasswordFindCode,
  verifyPasswordFindCode,
} from "@/features/students/api/students";
import CommonLogo from "../logos/commonlogo.png";
import "@/features/auth/themes/tchul.css";
import "@/features/auth/themes/limglish.css";
import styles from "./EnhancedCommonLoginPage.module.css";

function getTenantForLogin(programTenantCode: string | undefined): {
  tenantId: number | null;
  themeCode: "limglish" | "tchul";
} {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const match = pathname.match(/\/login\/([^/]+)/);
  const codeFromPath = match ? match[1] : null;
  const fromHost = getTenantCodeFromHostname();
  const code = codeFromPath || (fromHost.ok ? fromHost.code : null) || programTenantCode;
  const tenantId = code ? getTenantIdFromCode(code) : null;
  const themeCode = tenantId === 3 ? "limglish" : "tchul";
  return { tenantId, themeCode };
}

export default function EnhancedCommonLoginPage() {
  useDocumentTitle();

  const { program } = useProgram();
  const { tenantId, themeCode } = getTenantForLogin(program?.tenantCode);
  const branding = tenantId ? getTenantBranding(tenantId) : null;
  const title = program?.ui_config?.login_title ?? branding?.loginTitle ?? "로그인";
  const subtitle =
    program?.ui_config?.login_subtitle ??
    branding?.loginSubtitle ??
    (typeof window !== "undefined" ? window.location.hostname : "");
  const logoUrl = program?.ui_config?.logo_url ?? branding?.logoUrl;

  const [formExpanded, setFormExpanded] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPwFindModal, setShowPwFindModal] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupPending, setSignupPending] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [pwFindStep, setPwFindStep] = useState<1 | 2>(1);
  const [pwFindName, setPwFindName] = useState("");
  const [pwFindPhone, setPwFindPhone] = useState("");
  const [pwFindCode, setPwFindCode] = useState("");
  const [pwFindNewPassword, setPwFindNewPassword] = useState("");
  const [pwFindError, setPwFindError] = useState("");
  const [pwFindPending, setPwFindPending] = useState(false);
  const [pwFindSuccess, setPwFindSuccess] = useState(false);

  const [signupForm, setSignupForm] = useState({
    name: "",
    initialPassword: "",
    parentPhone: "",
    phone: "",
    schoolType: "HIGH" as "HIGH" | "MIDDLE",
    highSchool: "",
    middleSchool: "",
    highSchoolClass: "",
    major: "",
    grade: "",
    gender: "",
    memo: "",
  });

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
    <div
      data-app="auth"
      data-tenant={themeCode}
      className={styles.root}
    >
      <div className={styles.center}>
        <img
          src={logoUrl || CommonLogo}
          alt={title}
          className={styles.logo}
        />
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
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={pending}
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>
            {error && <div className={styles.error}>{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
