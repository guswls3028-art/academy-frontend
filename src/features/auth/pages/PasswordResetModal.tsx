import { useState, useEffect } from "react";
import { sendPasswordReset } from "@/features/students/api/students";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import styles from "./LoginPage.module.css";

interface PasswordResetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PasswordResetModal({ open, onClose }: PasswordResetModalProps) {
  const [target, setTarget] = useState<"student" | "parent">("student");
  const [name, setName] = useState("");
  const [psNumber, setPsNumber] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

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
      if (!psNumber.trim()) { setError("학생 번호를 입력해 주세요."); return; }
    } else {
      const phone = parentPhone.replace(/\D/g, "");
      if (phone.length !== 11 || !phone.startsWith("010")) {
        setError("학부모 전화번호를 010 뒤 8자리로 입력해 주세요."); return;
      }
    }
    setError("");
    setPending(true);
    try {
      await sendPasswordReset({
        target,
        student_name: trimmedName,
        student_ps_number: target === "student" ? psNumber.trim() : undefined,
        parent_phone: target === "parent" ? parentPhone : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setTarget("student");
        setName("");
        setPsNumber("");
        setParentPhone("");
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "임시 비밀번호 발송에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
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
        <h2 className={styles.overlayTitle} style={{ paddingLeft: 36 }}>비밀번호 찾기</h2>
        {success ? (
          <p style={{ color: "var(--auth-accent)", fontWeight: 600 }}>
            임시 비밀번호가 발송되었습니다. 문자를 확인한 뒤 로그인해 주세요.
          </p>
        ) : (
          <>
            <p style={{ fontSize: "0.875rem", color: "var(--auth-text-muted)", marginBottom: "1rem" }}>
              대상을 선택한 뒤 정보를 입력하시면 임시 비밀번호를 문자로 보내드립니다.
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
              {target === "student" ? (
                <input
                  className={styles.input}
                  placeholder="학생 번호 *"
                  value={psNumber}
                  onChange={(e) => setPsNumber(e.target.value)}
                />
              ) : (
                <div className={styles.signupPhoneRow}>
                <PhoneInput010Blocks
                  value={parentPhone}
                  onChange={setParentPhone}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  aria-label="학부모 전화번호"
                />
              </div>
              )}
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
