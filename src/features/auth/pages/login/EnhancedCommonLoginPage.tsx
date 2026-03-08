// PATH: src/features/auth/pages/login/EnhancedCommonLoginPage.tsx
// 테넌트 1, 3, 4, 9999 전용 — 로고 크기, 타이포그래피, 클릭 시 입력폼 (2번 제외)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api/auth";
import useAuth from "@/features/auth/hooks/useAuth";
import {
  submitRegistrationRequest,
  requestPasswordFindCode,
  verifyPasswordFindCode,
} from "@/features/students/api/students";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
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
    username: "",
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
    // 회원가입 시 모든 필드 필수 (계열 제외) — Limglish 등 운영 요구
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
      setSignupError("학부모 전화번호를 010 뒤 8자리로 입력해 주세요.");
      return;
    }
    const phone = signupForm.phone.replace(/\D/g, "");
    if (phone.length !== 11 || !phone.startsWith("010")) {
      setSignupError("휴대전화를 010 뒤 8자리로 입력해 주세요.");
      return;
    }
    if (!signupForm.gender.trim()) {
      setSignupError("성별을 선택해 주세요.");
      return;
    }
    if (signupForm.schoolType === "HIGH") {
      if (!signupForm.highSchool.trim()) {
        setSignupError("고등학교명을 입력해 주세요.");
        return;
      }
      if (!signupForm.originMiddleSchool.trim()) {
        setSignupError("출신중학교를 입력해 주세요.");
        return;
      }
    } else {
      if (!signupForm.middleSchool.trim()) {
        setSignupError("중학교명을 입력해 주세요.");
        return;
      }
    }
    if (!signupForm.highSchoolClass.trim()) {
      setSignupError("반을 입력해 주세요.");
      return;
    }
    const gradeNum = signupForm.grade.trim() ? Number(signupForm.grade) : NaN;
    if (!signupForm.grade.trim() || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 3) {
      setSignupError("학년을 입력해 주세요. (1~3)");
      return;
    }
    if (!signupForm.address.trim()) {
      setSignupError("주소를 입력해 주세요.");
      return;
    }

    setSignupPending(true);
    try {
      await submitRegistrationRequest({
        name: signupForm.name.trim(),
        username: signupForm.username.trim() || undefined,
        initialPassword: signupForm.initialPassword,
        parentPhone: parentPhone,
        phone,
        schoolType: signupForm.schoolType,
        highSchool: signupForm.highSchool.trim() || undefined,
        middleSchool: signupForm.middleSchool.trim() || undefined,
        highSchoolClass: signupForm.highSchoolClass.trim(),
        major: signupForm.major.trim() || undefined,
        grade: gradeNum,
        gender: signupForm.gender.trim(),
        address: signupForm.address.trim(),
        originMiddleSchool: signupForm.originMiddleSchool.trim() || undefined,
        memo: signupForm.memo.trim() || undefined,
      });
      setSignupSuccess(true);
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: Record<string, unknown>; status?: number } }).response
        : null;
      const data = res?.data as Record<string, unknown> | undefined;
      const status = res?.status;

      let msg: string;
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (typeof data.error === "string") {
          msg = data.error;
        } else if (Array.isArray(data.detail)) {
          msg = (data.detail as string[]).join(". ");
        } else if (data.detail && typeof data.detail === "object") {
          const parts: string[] = [];
          for (const [k, v] of Object.entries(data.detail)) {
            const s = Array.isArray(v) ? v.join(", ") : String(v);
            parts.push(s ? `${k}: ${s}` : k);
          }
          msg = parts.join(". ");
        } else {
          const parts: string[] = [];
          for (const [k, v] of Object.entries(data)) {
            if (k === "detail" || k === "error") continue;
            const s = Array.isArray(v) ? (v as string[]).join(", ") : String(v);
            if (s) parts.push(`${k}: ${s}`);
          }
          msg = parts.length ? parts.join(". ") : (status === 400 ? "입력값을 확인해 주세요." : "제출에 실패했습니다.");
        }
      } else {
        msg = err instanceof Error ? err.message : "제출에 실패했습니다.";
      }
      setSignupError(msg);
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
      setPwFindError("전화번호를 010 뒤 8자리로 입력해 주세요.");
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

  // 회원가입 모달: ESC로만 닫기 (외부 클릭으로는 닫지 않음)
  useEffect(() => {
    if (!showSignupModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSignupModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSignupModal, signupPending]);

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

      {/* 회원가입 모달 — 외부 클릭으로 닫히지 않음, ESC 또는 취소/확인 버튼으로만 닫기 */}
      {showSignupModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
          <div className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
            <h2 id="signup-modal-title" className={styles.overlayTitle}>학생 회원가입</h2>
            <p className={styles.overlaySubtitle}>
              필수 정보를 입력하시면 선생님 승인 후 로그인할 수 있습니다.
            </p>
            {signupSuccess ? (
              <>
                <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>신청이 완료되었습니다. 승인 후 로그인해 주세요.</p>
                <div className={styles.signupActions} style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className={styles.signupBtnSubmit}
                    onClick={() => {
                      setShowSignupModal(false);
                      setSignupSuccess(false);
                      setSignupForm({
                        name: "",
                        username: "",
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
                    }}
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmitSignup}>
                {/* 기본 정보 */}
                <section className={styles.signupSection} aria-labelledby="signup-basic">
                  <h3 id="signup-basic" className={styles.signupSectionTitle}>기본 정보</h3>
                  <div className={styles.signupNameGenderRow}>
                    <div className={styles.signupInputRow}>
                      <label htmlFor="signup-name" className={styles.signupInputLabel}>
                        이름 <span className={styles.signupRequired}>*</span>
                      </label>
                      <input
                        id="signup-name"
                        className={styles.signupInput}
                        placeholder="홍길동"
                        value={signupForm.name}
                        onChange={(e) => setSignupForm((f) => ({ ...f, name: e.target.value }))}
                        aria-required
                      />
                    </div>
                    <div className={styles.signupInputRow}>
                      <span className={styles.signupInputLabel}>성별 <span className={styles.signupRequired}>*</span></span>
                      <div className={styles.signupSegmentWrap} role="group" aria-label="성별">
                        {[
                          { key: "M", label: "남" },
                          { key: "F", label: "여" },
                        ].map((g) => (
                          <button
                            key={g.key}
                            type="button"
                            className={`${styles.signupSegmentBtn} ${signupForm.gender === g.key ? styles.isSelected : ""}`}
                            aria-pressed={signupForm.gender === g.key}
                            onClick={() => setSignupForm((f) => ({ ...f, gender: g.key }))}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.signupInputRow}>
                    <label htmlFor="signup-username" className={styles.signupInputLabel}>
                      아이디 (희망 로그인 ID)
                    </label>
                    <input
                      id="signup-username"
                      className={styles.signupInput}
                      placeholder="영문·숫자 조합"
                      value={signupForm.username}
                      onChange={(e) => setSignupForm((f) => ({ ...f, username: e.target.value }))}
                      autoComplete="username"
                    />
                  </div>
                  <div className={styles.signupInputRow}>
                    <label htmlFor="signup-pw" className={styles.signupInputLabel}>
                      비밀번호 <span className={styles.signupRequired}>*</span>
                    </label>
                    <input
                      id="signup-pw"
                      className={styles.signupInput}
                      type="password"
                      placeholder="4자리 이상"
                      value={signupForm.initialPassword}
                      onChange={(e) => setSignupForm((f) => ({ ...f, initialPassword: e.target.value }))}
                      aria-required
                    />
                    <span className={styles.signupInputLabel} style={{ marginTop: 4, marginBottom: 0 }}>숫자 또는 영문 사용 가능</span>
                  </div>
                </section>

                {/* 연락처 */}
                <section className={styles.signupSection} aria-labelledby="signup-contact">
                  <h3 id="signup-contact" className={styles.signupSectionTitle}>연락처</h3>
                  <div className={styles.signupPhoneRow}>
                    <span className={styles.signupInputLabel}>휴대전화 <span className={styles.signupRequired}>*</span></span>
                    <PhoneInput010Blocks
                      value={signupForm.phone}
                      onChange={(v) => setSignupForm((f) => ({ ...f, phone: v }))}
                      blockClassName={styles.signupPhoneBlock}
                      inputClassName={styles.signupPhoneBlockInput}
                      aria-label="휴대전화"
                    />
                  </div>
                  <div className={styles.signupPhoneRow}>
                    <span className={styles.signupInputLabel}>학부모 연락처 <span className={styles.signupRequired}>*</span></span>
                    <PhoneInput010Blocks
                      value={signupForm.parentPhone}
                      onChange={(v) => setSignupForm((f) => ({ ...f, parentPhone: v }))}
                      blockClassName={styles.signupPhoneBlock}
                      inputClassName={styles.signupPhoneBlockInput}
                      data-invalid={signupForm.parentPhone.replace(/\D/g, "").length !== 11 && signupForm.parentPhone.length > 0}
                      aria-label="학부모 연락처"
                    />
                  </div>
                </section>

                {/* 학교 정보 */}
                <section className={styles.signupSection} aria-labelledby="signup-school">
                  <h3 id="signup-school" className={styles.signupSectionTitle}>학교 정보</h3>
                  <div className={styles.signupSegmentWrap} role="group" aria-label="학교 유형">
                    <button
                      type="button"
                      className={`${styles.signupSegmentBtn} ${signupForm.schoolType === "HIGH" ? styles.isSelected : ""}`}
                      aria-pressed={signupForm.schoolType === "HIGH"}
                      onClick={() => setSignupForm((f) => ({ ...f, schoolType: "HIGH" }))}
                    >
                      고등학교
                    </button>
                    <button
                      type="button"
                      className={`${styles.signupSegmentBtn} ${signupForm.schoolType === "MIDDLE" ? styles.isSelected : ""}`}
                      aria-pressed={signupForm.schoolType === "MIDDLE"}
                      onClick={() => setSignupForm((f) => ({ ...f, schoolType: "MIDDLE" }))}
                    >
                      중학교
                    </button>
                  </div>
                  {signupForm.schoolType === "HIGH" ? (
                    <div className={styles.signupGrid2}>
                      <div className={styles.signupGrid2Full}>
                        <label htmlFor="signup-high" className={styles.signupInputLabel}>고등학교명 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-high"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.highSchool}
                          onChange={(e) => setSignupForm((f) => ({ ...f, highSchool: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="signup-grade" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-grade"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.grade}
                          onChange={(e) => setSignupForm((f) => ({ ...f, grade: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="signup-class" className={styles.signupInputLabel}>반 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-class"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.highSchoolClass}
                          onChange={(e) => setSignupForm((f) => ({ ...f, highSchoolClass: e.target.value }))}
                        />
                      </div>
                      <div className={styles.signupGrid2Full}>
                        <label htmlFor="signup-major" className={styles.signupInputLabel}>계열</label>
                        <input
                          id="signup-major"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.major}
                          onChange={(e) => setSignupForm((f) => ({ ...f, major: e.target.value }))}
                        />
                      </div>
                    </div>
                  ) : (
                    /* 중학교: 고등과 동일 레이아웃에서 계열·출신중학교만 제외 (중학교명, 학년, 반) */
                    <div className={styles.signupGrid2}>
                      <div className={styles.signupGrid2Full}>
                        <label htmlFor="signup-middle" className={styles.signupInputLabel}>중학교명 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-middle"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.middleSchool}
                          onChange={(e) => setSignupForm((f) => ({ ...f, middleSchool: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="signup-grade-middle" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-grade-middle"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.grade}
                          onChange={(e) => setSignupForm((f) => ({ ...f, grade: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="signup-class-middle" className={styles.signupInputLabel}>반 <span className={styles.signupRequired}>*</span></label>
                        <input
                          id="signup-class-middle"
                          className={styles.signupInput}
                          placeholder="선택"
                          value={signupForm.highSchoolClass}
                          onChange={(e) => setSignupForm((f) => ({ ...f, highSchoolClass: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* 추가 정보 — 고등일 때만 출신중학교 표시, 주소는 항상 */}
                <section className={styles.signupSection} aria-labelledby="signup-extra">
                  <h3 id="signup-extra" className={styles.signupSectionTitle}>추가 정보</h3>
                  {signupForm.schoolType === "HIGH" && (
                    <div className={styles.signupInputRow}>
                      <label htmlFor="signup-origin" className={styles.signupInputLabel}>출신중학교 <span className={styles.signupRequired}>*</span></label>
                      <input
                        id="signup-origin"
                        className={styles.signupInput}
                        placeholder="선택"
                        value={signupForm.originMiddleSchool}
                        onChange={(e) => setSignupForm((f) => ({ ...f, originMiddleSchool: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className={styles.signupInputRow}>
                    <label htmlFor="signup-address" className={styles.signupInputLabel}>주소 <span className={styles.signupRequired}>*</span></label>
                    <input
                      id="signup-address"
                      className={styles.signupInput}
                      placeholder="선택"
                      value={signupForm.address}
                      onChange={(e) => setSignupForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </section>

                <div className={styles.signupSectionDivider} aria-hidden />
                {signupError && <div className={styles.error}>{signupError}</div>}
                <div className={styles.signupActions}>
                  <button type="button" className={styles.signupBtnCancel} onClick={closeSignupModal}>
                    취소
                  </button>
                  <button type="submit" className={styles.signupBtnSubmit} disabled={signupPending}>
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
                <PhoneInput010Blocks
                  value={pwFindPhone}
                  onChange={setPwFindPhone}
                  className={styles.phoneBlocksWrap}
                  inputClassName={styles.input}
                  aria-label="전화번호"
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
