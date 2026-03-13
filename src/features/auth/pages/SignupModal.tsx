import { useState, useEffect } from "react";
import {
  submitRegistrationRequest,
  sendExistingCredentials,
} from "@/features/students/api/students";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
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
};

export default function SignupModal({ open, onClose }: SignupModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ phone: string; name: string } | null>(null);
  const [credentialsSent, setCredentialsSent] = useState(false);

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setError("");
      setSuccess(false);
      setDuplicateInfo(null);
      setCredentialsSent(false);
    }
  }, [open]);

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
      if (!form.originMiddleSchool.trim()) { setError("출신중학교를 입력해 주세요."); return; }
    } else {
      if (!form.middleSchool.trim()) { setError("중학교명을 입력해 주세요."); return; }
    }
    const gradeNum = form.grade.trim() ? Number(form.grade) : NaN;
    if (!form.grade.trim() || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 3) {
      setError("학년을 입력해 주세요. (1~3)"); return;
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
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
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
              <div className={styles.signupPhoneRow}>
                <span className={styles.signupInputLabel}>휴대전화 <span className={styles.signupRequired}>*</span></span>
                <PhoneInput010Blocks
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  aria-label="휴대전화"
                />
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
                <button
                  type="button"
                  className={`${styles.signupSegmentBtn} ${form.schoolType === "HIGH" ? styles.isSelected : ""}`}
                  aria-pressed={form.schoolType === "HIGH"}
                  onClick={() => setForm((f) => ({ ...f, schoolType: "HIGH" }))}
                >
                  고등학교
                </button>
                <button
                  type="button"
                  className={`${styles.signupSegmentBtn} ${form.schoolType === "MIDDLE" ? styles.isSelected : ""}`}
                  aria-pressed={form.schoolType === "MIDDLE"}
                  onClick={() => setForm((f) => ({ ...f, schoolType: "MIDDLE" }))}
                >
                  중학교
                </button>
              </div>
              {form.schoolType === "HIGH" ? (
                <div className={styles.signupGrid2}>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-high" className={styles.signupInputLabel}>고등학교명 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-high" className={styles.signupInput} placeholder="선택" value={form.highSchool} onChange={(e) => setForm((f) => ({ ...f, highSchool: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-grade" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-grade" className={styles.signupInput} placeholder="선택" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-class" className={styles.signupInputLabel}>반</label>
                    <input id="signup-class" className={styles.signupInput} placeholder="선택" value={form.highSchoolClass} onChange={(e) => setForm((f) => ({ ...f, highSchoolClass: e.target.value }))} />
                  </div>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-major" className={styles.signupInputLabel}>계열</label>
                    <input id="signup-major" className={styles.signupInput} placeholder="선택" value={form.major} onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className={styles.signupGrid2}>
                  <div className={styles.signupGrid2Full}>
                    <label htmlFor="signup-middle" className={styles.signupInputLabel}>중학교명 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-middle" className={styles.signupInput} placeholder="선택" value={form.middleSchool} onChange={(e) => setForm((f) => ({ ...f, middleSchool: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-grade-middle" className={styles.signupInputLabel}>학년 <span className={styles.signupRequired}>*</span></label>
                    <input id="signup-grade-middle" className={styles.signupInput} placeholder="선택" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="signup-class-middle" className={styles.signupInputLabel}>반</label>
                    <input id="signup-class-middle" className={styles.signupInput} placeholder="선택" value={form.highSchoolClass} onChange={(e) => setForm((f) => ({ ...f, highSchoolClass: e.target.value }))} />
                  </div>
                </div>
              )}
            </section>

            {/* 추가 정보 */}
            <section className={styles.signupSection} aria-labelledby="signup-extra">
              <h3 id="signup-extra" className={styles.signupSectionTitle}>추가 정보</h3>
              {form.schoolType === "HIGH" && (
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
