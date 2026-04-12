import { useState, useEffect } from "react";
import { sendPasswordReset } from "@admin/domains/students/api/students.api";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import styles from "./LoginPage.module.css";

interface PasswordResetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PasswordResetModal({ open, onClose }: PasswordResetModalProps) {
  const [target, setTarget] = useState<"student" | "parent">("student");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (open) {
      setTarget("student");
      setName("");
      setPhone("");
      setParentPhone("");
      setError("");
      setSuccess(false);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError("학생 이름을 입력해 주세요."); return; }
    if (target === "student") {
      const studentPhone = phone.replace(/\D/g, "");
      if (studentPhone.length !== 11 || !studentPhone.startsWith("010")) {
        setError("전화번호를 010 뒤 8자리로 입력해 주세요."); return;
      }
    } else {
      const parentP = parentPhone.replace(/\D/g, "");
      if (parentP.length !== 11 || !parentP.startsWith("010")) {
        setError("학부모 전화번호를 010 뒤 8자리로 입력해 주세요."); return;
      }
    }
    setError("");
    setPending(true);
    try {
      await sendPasswordReset({
        target,
        student_name: trimmedName,
        student_phone: target === "student" ? phone : undefined,
        parent_phone: target === "parent" ? parentPhone : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setTarget("student");
        setName("");
        setPhone("");
        setParentPhone("");
        setSuccess(false);
      }, 4000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || (err instanceof Error ? err.message : "임시 비밀번호 발송에 실패했습니다."));
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="pw-reset-title" onClick={handleClose}>
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
        <h2 id="pw-reset-title" className={styles.overlayTitle} style={{ paddingLeft: 36 }}>비밀번호 찾기</h2>
        {success ? (
          <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>
            임시 비밀번호가 발송되었습니다. 알림톡을 확인한 뒤 로그인해 주세요.
          </p>
        ) : (
          <>
            <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1rem" }}>
              대상을 선택한 뒤 정보를 입력하시면 임시 비밀번호를 알림톡으로 보내드립니다.
            </p>
            <div className={styles.signupSegmentWrap} role="group" aria-label="대상 선택" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${target === "student" ? styles.isSelected : ""}`}
                aria-pressed={target === "student"}
                onClick={() => setTarget("student")}
              >
                학생
              </button>
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${target === "parent" ? styles.isSelected : ""}`}
                aria-pressed={target === "parent"}
                onClick={() => setTarget("parent")}
              >
                학부모
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <input
                className={styles.input}
                placeholder="학생 이름 *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className={styles.signupPhoneRow}>
                <span className={styles.signupInputLabel} style={{ marginBottom: 4 }}>
                  {target === "student" ? "학생 또는 학부모 전화번호 *" : "학부모 전화번호 *"}
                </span>
                <PhoneInput010Blocks
                  value={target === "student" ? phone : parentPhone}
                  onChange={target === "student" ? setPhone : setParentPhone}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  aria-label={target === "student" ? "학생 전화번호" : "학부모 전화번호"}
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.overlayActions}>
                <button type="button" className={styles.btnSecondary} onClick={handleClose}>취소</button>
                <button type="submit" className={styles.btnPrimary} disabled={pending}>
                  {pending ? "발송 중..." : "임시 비밀번호 받기"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
