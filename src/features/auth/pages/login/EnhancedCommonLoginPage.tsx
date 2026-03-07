// PATH: src/features/auth/pages/login/EnhancedCommonLoginPage.tsx
// 테넌트 1, 3, 4, 9999 전용 — 로고 크기, 타이포그래피, 클릭 시 입력폼 (2번 제외)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import {
  submitRegistrationRequest,
  requestPasswordFindCode,
  verifyPasswordFindCode,
} from "@/features/students/api/students";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { useProgram } from "@/shared/program";
import {
  getTenantCodeFromHostname,
  getTenantIdFromCode,
  getTenantBranding,
} from "@/shared/tenant";
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
    address: "",
    originMiddleSchool: "",
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

  async function onSubmitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupPending) return;
    setSignupError("");
    if (!signupForm.name.trim()) {
      setSignupError("이름을 입력해 주세요.");
      return;
    }
    if (!signupForm.initialPassword.trim() || signupForm.initialPassword.length < 4) {
      setSignupError("초기 비밀번호를 4자 이상 입력해 주세요.");
      return;
    }
    const parentPhone = signupForm.parentPhone.replace(/\D/g, "");
    if (parentPhone.length !== 11 || !parentPhone.startsWith("010")) {
      setSignupError("학부모 전화번호를 010XXXXXXXX 11자리로 입력해 주세요.");
      return;
    }
    setSignupPending(true);
    try {
      await submitRegistrationRequest({
        name: signupForm.name.trim(),
        initialPassword: signupForm.initialPassword,
        parentPhone: parentPhone,
        phone: signupForm.phone.replace(/\D/g, "").length === 11 ? signupForm.phone.replace(/\D/g, "") : undefined,
        schoolType: signupForm.schoolType,
        highSchool: signupForm.highSchool.trim() || undefined,
        middleSchool: signupForm.middleSchool.trim() || undefined,
        highSchoolClass: signupForm.highSchoolClass.trim() || undefined,
        major: signupForm.major.trim() || undefined,
        grade: signupForm.grade ? Number(signupForm.grade) : undefined,
        gender: signupForm.gender.trim() || undefined,
        address: signupForm.address.trim() || undefined,
        originMiddleSchool: signupForm.originMiddleSchool.trim() || undefined,
        memo: signupForm.memo.trim() || undefined,
      });
      setSignupSuccess(true);
      setTimeout(() => {
        setShowSignupModal(false);
        setSignupSuccess(false);
        setSignupForm({
          name: "",
          initialPassword: "",
          parentPhone: "",
          phone: "",
          schoolType: "HIGH",
          highSchool: "",
          middleSchool: "",
          highSchoolClass: "",
          major: "",
          grade: "",
          gender: "",
          address: "",
          originMiddleSchool: "",
          memo: "",
        });
      }, 1500);
    } catch (err) {
      setSignupError(err instanceof Error ? err.message : "제출에 실패했습니다.");
    } finally {
      setSignupPending(false);
    }
  }

  async function onPwFindRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (pwFindPending || pwFindStep !== 1) return;
    const name = pwFindName.trim();
    const phone = pwFindPhone.replace(/\D/g, "");
    if (!name) {
      setPwFindError("이름을 입력해 주세요.");
      return;
    }
    if (phone.length !== 11 || !phone.startsWith("010")) {
      setPwFindError("전화번호를 010XXXXXXXX 11자리로 입력해 주세요.");
      return;
    }
    setPwFindError("");
    setPwFindPending(true);
    try {
      await requestPasswordFindCode(name, phone);
      setPwFindStep(2);
    } catch (err) {
      setPwFindError(err instanceof Error ? err.message : "인증번호 요청에 실패했습니다.");
    } finally {
      setPwFindPending(false);
    }
  }

  async function onPwFindVerify(e: React.FormEvent) {
    e.preventDefault();
    if (pwFindPending || pwFindStep !== 2) return;
    const phone = pwFindPhone.replace(/\D/g, "");
    if (pwFindCode.length !== 6 || pwFindNewPassword.length < 4) {
      setPwFindError("인증번호 6자리와 새 비밀번호(4자 이상)를 입력해 주세요.");
      return;
    }
    setPwFindError("");
    setPwFindPending(true);
    try {
      await verifyPasswordFindCode(phone, pwFindCode, pwFindNewPassword);
      setPwFindSuccess(true);
      setTimeout(() => {
        setShowPwFindModal(false);
        setPwFindStep(1);
        setPwFindName("");
        setPwFindPhone("");
        setPwFindCode("");
        setPwFindNewPassword("");
        setPwFindSuccess(false);
      }, 1500);
    } catch (err) {
      setPwFindError(err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setPwFindPending(false);
    }
  }

  function closeSignupModal() {
    if (!signupPending) {
      setShowSignupModal(false);
      setSignupError("");
      setSignupSuccess(false);
    }
  }

  function closePwFindModal() {
    if (!pwFindPending) {
      setShowPwFindModal(false);
      setPwFindStep(1);
      setPwFindError("");
      setPwFindSuccess(false);
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
            <div className={styles.links}>
              <button
                type="button"
                className={styles.link}
                onClick={() => setShowSignupModal(true)}
              >
                회원가입
              </button>
              <span style={{ color: "var(--auth-text-muted)" }}>|</span>
              <button
                type="button"
                className={styles.link}
                onClick={() => setShowPwFindModal(true)}
              >
                비밀번호 찾기
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 회원가입 모달 */}
      {showSignupModal && (
        <div className={styles.overlay} onClick={closeSignupModal}>
          <div className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.overlayTitle}>학생 회원가입</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1rem" }}>
              필수 정보를 입력하시면 선생님 승인 후 로그인할 수 있습니다.
            </p>
            {signupSuccess ? (
              <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>신청이 완료되었습니다. 승인 후 로그인해 주세요.</p>
            ) : (
              <form onSubmit={onSubmitSignup}>
                <input
                  className={styles.input}
                  placeholder="이름 *"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className={styles.input}
                  type="password"
                  placeholder="초기 비밀번호 (4자 이상) *"
                  value={signupForm.initialPassword}
                  onChange={(e) => setSignupForm((f) => ({ ...f, initialPassword: e.target.value }))}
                />
                <input
                  className={styles.input}
                  placeholder="학부모 전화번호 (010XXXXXXXX) *"
                  value={signupForm.parentPhone}
                  onChange={(e) => setSignupForm((f) => ({ ...f, parentPhone: e.target.value }))}
                />
                <input
                  className={styles.input}
                  placeholder="학생 전화번호 (선택)"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <select
                  className={styles.input}
                  value={signupForm.schoolType}
                  onChange={(e) => setSignupForm((f) => ({ ...f, schoolType: e.target.value as "HIGH" | "MIDDLE" }))}
                >
                  <option value="HIGH">고등</option>
                  <option value="MIDDLE">중등</option>
                </select>
                {signupForm.schoolType === "HIGH" ? (
                  <>
                    <input
                      className={styles.input}
                      placeholder="고등학교명 (선택)"
                      value={signupForm.highSchool}
                      onChange={(e) => setSignupForm((f) => ({ ...f, highSchool: e.target.value }))}
                    />
                    <input
                      className={styles.input}
                      placeholder="학년 (선택)"
                      value={signupForm.grade}
                      onChange={(e) => setSignupForm((f) => ({ ...f, grade: e.target.value }))}
                    />
                    <input
                      className={styles.input}
                      placeholder="반 (선택)"
                      value={signupForm.highSchoolClass}
                      onChange={(e) => setSignupForm((f) => ({ ...f, highSchoolClass: e.target.value }))}
                    />
                    <input
                      className={styles.input}
                      placeholder="계열/과 (선택)"
                      value={signupForm.major}
                      onChange={(e) => setSignupForm((f) => ({ ...f, major: e.target.value }))}
                    />
                    <input
                      className={styles.input}
                      placeholder="출신중학교 (선택)"
                      value={signupForm.originMiddleSchool}
                      onChange={(e) => setSignupForm((f) => ({ ...f, originMiddleSchool: e.target.value }))}
                    />
                  </>
                ) : (
                  <input
                    className={styles.input}
                    placeholder="중학교명 (선택)"
                    value={signupForm.middleSchool}
                    onChange={(e) => setSignupForm((f) => ({ ...f, middleSchool: e.target.value }))}
                  />
                )}
                <input
                  className={styles.input}
                  placeholder="주소 (선택)"
                  value={signupForm.address}
                  onChange={(e) => setSignupForm((f) => ({ ...f, address: e.target.value }))}
                />
                <textarea
                  className={styles.input}
                  placeholder="메모 (선택)"
                  value={signupForm.memo}
                  onChange={(e) => setSignupForm((f) => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  style={{ resize: "vertical", minHeight: "2.5rem" }}
                />
                {signupError && <div className={styles.error}>{signupError}</div>}
                <div className={styles.overlayActions}>
                  <button type="button" className={styles.btnSecondary} onClick={closeSignupModal}>
                    취소
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={signupPending}>
                    {signupPending ? "제출 중..." : "가입 신청"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 비밀번호 찾기 모달 */}
      {showPwFindModal && (
        <div className={styles.overlay} onClick={closePwFindModal}>
          <div className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.overlayTitle}>비밀번호 찾기</h2>
            {pwFindSuccess ? (
              <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.</p>
            ) : pwFindStep === 1 ? (
              <form onSubmit={onPwFindRequestCode}>
                <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1rem" }}>
                  이름과 전화번호가 일치하면 문자로 인증번호를 보내드립니다.
                </p>
                <input
                  className={styles.input}
                  placeholder="이름 *"
                  value={pwFindName}
                  onChange={(e) => setPwFindName(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="전화번호 (010XXXXXXXX) *"
                  value={pwFindPhone}
                  onChange={(e) => setPwFindPhone(e.target.value)}
                />
                {pwFindError && <div className={styles.error}>{pwFindError}</div>}
                <div className={styles.overlayActions}>
                  <button type="button" className={styles.btnSecondary} onClick={closePwFindModal}>
                    취소
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={pwFindPending}>
                    {pwFindPending ? "요청 중..." : "인증번호 받기"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onPwFindVerify}>
                <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1rem" }}>
                  문자로 받은 6자리 인증번호와 새 비밀번호를 입력하세요.
                </p>
                <input
                  className={styles.input}
                  placeholder="인증번호 6자리 *"
                  value={pwFindCode}
                  onChange={(e) => setPwFindCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
                <input
                  className={styles.input}
                  type="password"
                  placeholder="새 비밀번호 (4자 이상) *"
                  value={pwFindNewPassword}
                  onChange={(e) => setPwFindNewPassword(e.target.value)}
                />
                {pwFindError && <div className={styles.error}>{pwFindError}</div>}
                <div className={styles.overlayActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setPwFindStep(1)}>
                    이전
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={pwFindPending}>
                    {pwFindPending ? "변경 중..." : "비밀번호 변경"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
