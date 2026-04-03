import { useState, useEffect } from "react";
import {
  submitRegistrationRequest,
  sendExistingCredentials,
  checkSignupDuplicate,
} from "@/features/students/api/students";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import type { SchoolType } from "@/shared/hooks/useSchoolLevelMode";
import styles from "./LoginPage.module.css";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL_FORM = {
  name: "",
  username: "",
  initialPassword: "",
  parentPhone: "",
  phone: "",
  schoolType: "HIGH" as SchoolType,
  elementarySchool: "",
  highSchool: "",
  middleSchool: "",
  highSchoolClass: "",
  major: "",
  grade: "",
  gender: "",
  address: "",
  originMiddleSchool: "",
  memo: "",
};

export default function SignupModal({ open, onClose }: SignupModalProps) {
  const slm = useSchoolLevelMode();
  const [form, setForm] = useState<typeof INITIAL_FORM>({ ...INITIAL_FORM, schoolType: slm.defaultSchoolType });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ phone: string; name: string } | null>(null);
  const [credentialsSent, setCredentialsSent] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<{ available: boolean; reason?: string } | null>(null);
  const [phoneCheck, setPhoneCheck] = useState<{ available: boolean; reason?: string } | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // 모달 열릴 때 폼 초기화 (defaultSchoolType 반영)
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL_FORM, schoolType: slm.defaultSchoolType });
      setError("");
      setSuccess(false);
      setDuplicateInfo(null);
      setCredentialsSent(false);
      setUsernameCheck(null);
      setPhoneCheck(null);
    }
  }, [open, slm.defaultSchoolType]);

  async function handleCheckUsername() {
    const val = form.username.trim();
    if (!val) { setUsernameCheck(null); return; }
    setCheckingUsername(true);
    try {
      const res = await checkSignupDuplicate({ username: val });
      setUsernameCheck(res.username ?? null);
    } catch { setUsernameCheck(null); }
    finally { setCheckingUsername(false); }
  }

  async function handleCheckPhone() {
    const val = form.phone.replace(/\D/g, "");
    if (val.length !== 11 || !val.startsWith("010")) { setPhoneCheck(null); return; }
    setCheckingPhone(true);
    try {
      const res = await checkSignupDuplicate({ phone: val });
      setPhoneCheck(res.phone ?? null);
    } catch { setPhoneCheck(null); }
    finally { setCheckingPhone(false); }
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  function handleClose() {
    if (!pending) {
      onClose();
      setError("");
      setSuccess(false);
    }
  }

  function handleConfirmSuccess() {
    onClose();
    setSuccess(false);
    setForm(INITIAL_FORM);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");

    if (!form.name.trim()) { setError("이름을 입력해 주세요."); return; }
    if (!form.username.trim()) { setError("아이디를 입력해 주세요."); return; }
    if (!form.initialPassword.trim() || form.initialPassword.length < 4) {
      setError("초기 비밀번호를 4자 이상 입력해 주세요."); return;
    }
    const parentPhone = form.parentPhone.replace(/\D/g, "");
    if (parentPhone.length !== 11 || !parentPhone.startsWith("010")) {
      setError("학부모 전화번호를 010 뒤 8자리로 입력해 주세요."); return;
    }
    const phone = form.phone.replace(/\D/g, "");
    if (phone.length !== 11 || !phone.startsWith("010")) {
      setError("휴대전화를 010 뒤 8자리로 입력해 주세요."); return;
    }
    if (!form.gender.trim()) { setError("성별을 선택해 주세요."); return; }
    if (form.schoolType === "HIGH") {
      if (!form.highSchool.trim()) { setError("고등학교명을 입력해 주세요."); return; }
      if (slm.showOriginMiddleSchool("HIGH") && !form.originMiddleSchool.trim()) {
        setError("출신중학교를 입력해 주세요."); return;
      }
    } else if (form.schoolType === "MIDDLE") {
      if (!form.middleSchool.trim()) { setError("중학교명을 입력해 주세요."); return; }
    } else if (form.schoolType === "ELEMENTARY") {
      if (!form.elementarySchool.trim()) { setError("초등학교명을 입력해 주세요."); return; }
    }
    const allowedGrades = slm.gradeRange(form.schoolType);
    const gradeNum = form.grade.trim() ? Number(form.grade) : NaN;
    if (!form.grade.trim() || isNaN(gradeNum) || !allowedGrades.includes(gradeNum)) {
      setError(`학년을 입력해 주세요. (1~${allowedGrades[allowedGrades.length - 1]})`); return;
    }
    if (!form.address.trim()) { setError("주소를 입력해 주세요."); return; }

    setPending(true);
    try {
      await submitRegistrationRequest({
        name: form.name.trim(),
        username: form.username.trim() || undefined,
        initialPassword: form.initialPassword,
        parentPhone: parentPhone,
        phone,
        schoolType: form.schoolType,
        highSchool: form.highSchool.trim() || undefined,
        middleSchool: form.middleSchool.trim() || undefined,
        highSchoolClass: form.highSchoolClass.trim(),
        major: form.major.trim() || undefined,
        grade: gradeNum,
        gender: form.gender.trim(),
        address: form.address.trim(),
        originMiddleSchool: form.originMiddleSchool.trim() || undefined,
        memo: form.memo.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: Record<string, unknown>; status?: number } }).response
        : null;
      const data = res?.data as Record<string, unknown> | undefined;
      const status = res?.status;

      // 409: 이미 등록된 학생
      if (status === 409 && data?.code === "already_registered") {
        setDuplicateInfo({
          phone: String(data.student_phone ?? form.phone ?? ""),
          name: String(data.student_name ?? form.name ?? ""),
        });
        setPending(false);
        return;
      }

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
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
      <div className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.overlayClose}
          onClick={handleClose}
          aria-label="닫기"
          disabled={pending}
        >
          ✕
        </button>
        <h2 id="signup-modal-title" className={styles.overlayTitle} style={{ paddingLeft: 36 }}>학생 회원가입</h2>
        <p className={styles.overlaySubtitle}>
          필수 정보를 입력하시면 선생님 승인 후 로그인할 수 있습니다.
        </p>
        {duplicateInfo ? (
          <>
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--auth-text)", marginBottom: "0.75rem" }}>
                이미 가입된 아이디입니다.
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                아이디와 임시 비밀번호를 알림톡으로 받으시겠습니까?
              </p>
              {credentialsSent ? (
                <p style={{ color: "var(--auth-accent)", fontWeight: 600, marginBottom: "1rem" }}>
                  알림톡이 발송되었습니다. 확인 후 로그인해 주세요.
                </p>
              ) : (
                <>
                  {error && <div className={styles.error} style={{ marginBottom: "0.75rem" }}>{error}</div>}
                  <button
                    type="button"
                    className={styles.signupBtnSubmit}
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      setError("");
                      try {
                        await sendExistingCredentials({
                          phone: duplicateInfo.phone,
                          name: duplicateInfo.name,
                        });
                        setCredentialsSent(true);
                      } catch (e: unknown) {
                        const errObj = e as { response?: { data?: { detail?: string } }; message?: string };
                        setError(errObj?.response?.data?.detail || errObj?.message || "발송에 실패했습니다.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {pending ? "발송 중..." : "카카오톡으로 ID/비밀번호 발송"}
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.signupBtnCancel}
                style={{ width: "100%", marginTop: credentialsSent ? "0.5rem" : 0 }}
                onClick={() => {
                  if (credentialsSent) {
                    handleClose();
                  } else {
                    setDuplicateInfo(null);
                    setError("");
                  }
                }}
              >
                {credentialsSent ? "확인" : "돌아가기"}
              </button>
            </div>
          </>
        ) : success ? (
          <>
            <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>신청이 완료되었습니다. 승인 후 로그인해 주세요.</p>
            <div className={styles.signupActions} style={{ marginTop: 20 }}>
              <button type="button" className={styles.signupBtnSubmit} onClick={handleConfirmSuccess}>
                확인
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
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
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                        className={`${styles.signupSegmentBtn} ${form.gender === g.key ? styles.isSelected : ""}`}
                        aria-pressed={form.gender === g.key}
                        onClick={() => setForm((f) => ({ ...f, gender: g.key }))}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.signupInputRow}>
                <label htmlFor="signup-username" className={styles.signupInputLabel}>
                  아이디 (희망 로그인 ID) <span className={styles.signupRequired}>*</span>
                </label>
                <input
                  id="signup-username"
                  className={styles.signupInput}
                  placeholder="영문·숫자 조합"
                  value={form.username}
                  onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); setUsernameCheck(null); }}
                  onBlur={handleCheckUsername}
                  autoComplete="username"
                />
                {checkingUsername && <span style={{ fontSize: "0.75rem", color: "var(--auth-text-muted)" }}>확인 중...</span>}
                {usernameCheck && !checkingUsername && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: usernameCheck.available ? "var(--color-success, #16a34a)" : "var(--color-error, #dc2626)" }}>
                    {usernameCheck.available ? "사용 가능한 아이디입니다." : usernameCheck.reason}
                  </span>
                )}
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
                  value={form.initialPassword}
                  onChange={(e) => setForm((f) => ({ ...f, initialPassword: e.target.value }))}
                  aria-required
                />
                <span className={styles.signupInputLabel} style={{ marginTop: 4, marginBottom: 0 }}>숫자 또는 영문 사용 가능</span>
              </div>
            </section>

            {/* 연락처 */}
            <section className={styles.signupSection} aria-labelledby="signup-contact">
              <h3 id="signup-contact" className={styles.signupSectionTitle}>연락처</h3>
              <div className={styles.signupPhoneRow} onBlur={(e) => {
                // 포커스가 이 row 밖으로 나갈 때만 검사
                if (!e.currentTarget.contains(e.relatedTarget as Node)) handleCheckPhone();
              }}>
                <span className={styles.signupInputLabel}>휴대전화 <span className={styles.signupRequired}>*</span></span>
                <PhoneInput010Blocks
                  value={form.phone}
                  onChange={(v) => { setForm((f) => ({ ...f, phone: v })); setPhoneCheck(null); }}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  aria-label="휴대전화"
                />
                {checkingPhone && <span style={{ fontSize: "0.75rem", color: "var(--auth-text-muted)" }}>확인 중...</span>}
                {phoneCheck && !checkingPhone && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: phoneCheck.available ? "var(--color-success, #16a34a)" : "var(--color-error, #dc2626)" }}>
                    {phoneCheck.available ? "사용 가능한 전화번호입니다." : phoneCheck.reason}
                  </span>
                )}
              </div>
              <div className={styles.signupPhoneRow}>
                <span className={styles.signupInputLabel}>학부모 연락처 <span className={styles.signupRequired}>*</span></span>
                <PhoneInput010Blocks
                  value={form.parentPhone}
                  onChange={(v) => setForm((f) => ({ ...f, parentPhone: v }))}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  data-invalid={form.parentPhone.replace(/\D/g, "").length !== 11 && form.parentPhone.length > 0}
                  aria-label="학부모 연락처"
                />
              </div>
            </section>

            {/* 학교 정보 */}
            <section className={styles.signupSection} aria-labelledby="signup-school">
              <h3 id="signup-school" className={styles.signupSectionTitle}>학교 정보</h3>
              <div className={styles.signupSegmentWrap} role="group" aria-label="학교 유형">
                {slm.schoolTypes.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`${styles.signupSegmentBtn} ${form.schoolType === st ? styles.isSelected : ""}`}
                    aria-pressed={form.schoolType === st}
                    onClick={() => setForm((f) => ({ ...f, schoolType: st, grade: "" }))}
                  >
                    {slm.labels[st]}
                  </button>
                ))}
              </div>
              {form.schoolType === "ELEMENTARY" && (
                <div className={styles.signupGrid2}>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-elementary" className={styles.signupInputLabel}>초등학교명 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-elementary" className={styles.signupInput} placeholder="학교명 입력" value={form.elementarySchool} onChange={(e) => setForm((f) => ({ ...f, elementarySchool: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-grade-elem" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                    <div className={styles.signupSegmentWrap} role="group" aria-label="학년">
                      {slm.gradeRange("ELEMENTARY").map((g) => (
                        <button key={g} type="button"
                          className={`${styles.signupSegmentBtn} ${form.grade === String(g) ? styles.isSelected : ""}`}
                          aria-pressed={form.grade === String(g)}
                          onClick={() => setForm((f) => ({ ...f, grade: String(g) }))}>
                          {g}학년
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-class-elem" className={styles.signupInputLabel}>반</label>
                    <input id="signup-class-elem" className={styles.signupInput} placeholder="선택" value={form.highSchoolClass} onChange={(e) => setForm((f) => ({ ...f, highSchoolClass: e.target.value }))} />
                  </div>
                </div>
              )}
              {form.schoolType === "MIDDLE" && (
                <div className={styles.signupGrid2}>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-middle" className={styles.signupInputLabel}>중학교명 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-middle" className={styles.signupInput} placeholder="학교명 입력" value={form.middleSchool} onChange={(e) => setForm((f) => ({ ...f, middleSchool: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-grade-middle" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                    <div className={styles.signupSegmentWrap} role="group" aria-label="학년">
                      {slm.gradeRange("MIDDLE").map((g) => (
                        <button key={g} type="button"
                          className={`${styles.signupSegmentBtn} ${form.grade === String(g) ? styles.isSelected : ""}`}
                          aria-pressed={form.grade === String(g)}
                          onClick={() => setForm((f) => ({ ...f, grade: String(g) }))}>
                          {g}학년
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-class-middle" className={styles.signupInputLabel}>반</label>
                    <input id="signup-class-middle" className={styles.signupInput} placeholder="선택" value={form.highSchoolClass} onChange={(e) => setForm((f) => ({ ...f, highSchoolClass: e.target.value }))} />
                  </div>
                </div>
              )}
              {form.schoolType === "HIGH" && (
                <div className={styles.signupGrid2}>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-high" className={styles.signupInputLabel}>고등학교명 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-high" className={styles.signupInput} placeholder="학교명 입력" value={form.highSchool} onChange={(e) => setForm((f) => ({ ...f, highSchool: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-grade" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                    <div className={styles.signupSegmentWrap} role="group" aria-label="학년">
                      {slm.gradeRange("HIGH").map((g) => (
                        <button key={g} type="button"
                          className={`${styles.signupSegmentBtn} ${form.grade === String(g) ? styles.isSelected : ""}`}
                          aria-pressed={form.grade === String(g)}
                          onClick={() => setForm((f) => ({ ...f, grade: String(g) }))}>
                          {g}학년
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-class" className={styles.signupInputLabel}>반</label>
                    <input id="signup-class" className={styles.signupInput} placeholder="선택" value={form.highSchoolClass} onChange={(e) => setForm((f) => ({ ...f, highSchoolClass: e.target.value }))} />
                  </div>
                  {slm.showTrack("HIGH") && (
                    <div className={styles.signupGrid2Full}>
                      <label htmlFor="signup-major" className={styles.signupInputLabel}>계열</label>
                      <input id="signup-major" className={styles.signupInput} placeholder="선택" value={form.major} onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 추가 정보 */}
            <section className={styles.signupSection} aria-labelledby="signup-extra">
              <h3 id="signup-extra" className={styles.signupSectionTitle}>추가 정보</h3>
              {slm.showOriginMiddleSchool(form.schoolType) && (
                <div className={styles.signupInputRow}>
                  <label htmlFor="signup-origin" className={styles.signupInputLabel}>출신중학교 <span className={styles.signupRequired}>*</span></label>
                  <input id="signup-origin" className={styles.signupInput} placeholder="선택" value={form.originMiddleSchool} onChange={(e) => setForm((f) => ({ ...f, originMiddleSchool: e.target.value }))} />
                </div>
              )}
              <div className={styles.signupInputRow}>
                <label htmlFor="signup-address" className={styles.signupInputLabel}>주소 <span className={styles.signupRequired}>*</span></label>
                <input id="signup-address" className={styles.signupInput} placeholder="선택" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </section>

            <div className={styles.signupSectionDivider} aria-hidden />
            <p className={styles.signupLegalNotice}>
              가입 시{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>
              {" "}및{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>
              에 동의한 것으로 간주합니다.
              <br />
              만 14세 미만 학생은 보호자(학부모)의 동의가 필요하며, 학원을 통해 등록해 주세요.
            </p>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.signupActions}>
              <button type="button" className={styles.signupBtnCancel} onClick={handleClose}>취소</button>
              <button type="submit" className={styles.signupBtnSubmit} disabled={pending}>
                {pending ? "제출 중..." : "가입 신청"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
