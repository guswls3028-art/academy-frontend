import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  dispatchAccountRecovery,
  type AccountRecoveryMode,
  type AccountRecoveryTarget,
} from "@/auth/api/recovery.api";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./LoginPage.module.css";

interface AccountRecoveryModalProps {
  open: boolean;
  initialMode: AccountRecoveryMode;
  onClose: () => void;
}

const SUCCESS_FALLBACK: Record<AccountRecoveryMode, string> = {
  username: "입력한 정보가 등록되어 있다면 해당 번호로 아이디 안내가 발송됩니다.",
  password: "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호가 발송됩니다.",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function AccountRecoveryModal({ open, initialMode, onClose }: AccountRecoveryModalProps) {
  const [mode, setMode] = useState<AccountRecoveryMode>(initialMode);
  const [target, setTarget] = useState<AccountRecoveryTarget>("student");
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const studentNameInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  const resetForm = useCallback((nextMode: AccountRecoveryMode) => {
    setMode(nextMode);
    setTarget("student");
    setStudentName("");
    setPhone("");
    setError("");
    setSuccessMessage("");
  }, []);

  useEffect(() => {
    if (open) {
      clearSuccessTimer();
      resetForm(initialMode);
    }
  }, [clearSuccessTimer, initialMode, open, resetForm]);

  useEffect(() => clearSuccessTimer, [clearSuccessTimer]);

  const handleClose = useCallback(() => {
    if (pending) return;
    clearSuccessTimer();
    onClose();
    setError("");
    setSuccessMessage("");
  }, [clearSuccessTimer, onClose, pending]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const overlayEl = overlayRef.current;
    const rootEl = overlayEl?.parentElement;
    const siblings = rootEl
      ? Array.from(rootEl.children).filter((element) => element !== overlayEl)
      : [];
    const previousSiblingState = siblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement & { inert?: boolean }).inert,
    }));
    siblings.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      (element as HTMLElement & { inert?: boolean }).inert = true;
    });

    const focusInitial = window.requestAnimationFrame(() => {
      studentNameInputRef.current?.focus();
    });

    const getFocusable = () => {
      const card = cardRef.current;
      if (!card) return [];
      return Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (!focusable.length) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", onKeyDown, true);
      previousSiblingState.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
        (element as HTMLElement & { inert?: boolean }).inert = inert;
      });
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [handleClose, open]);

  function selectMode(nextMode: AccountRecoveryMode) {
    setMode(nextMode);
    setError("");
    setSuccessMessage("");
  }

  function selectTarget(nextTarget: AccountRecoveryTarget) {
    setTarget(nextTarget);
    setError("");
    setSuccessMessage("");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const name = studentName.trim();
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!name) {
      setError("학생 이름을 입력해 주세요.");
      return;
    }
    if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith("010")) {
      setError("휴대폰 번호를 010 뒤 8자리로 입력해 주세요.");
      return;
    }

    setError("");
    setPending(true);
    try {
      const result = await dispatchAccountRecovery({
        mode,
        target,
        studentName: name,
        phone: normalizedPhone,
      });
      setSuccessMessage(result.message || SUCCESS_FALLBACK[mode]);
      clearSuccessTimer();
      successTimerRef.current = setTimeout(() => {
        onClose();
        resetForm(mode);
      }, 4500);
    } catch (err: unknown) {
      setError(extractApiError(err, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  const title = mode === "username" ? "아이디 찾기" : "비밀번호 찾기";
  const submitLabel = mode === "username" ? "아이디 안내 받기" : "임시 비밀번호 받기";
  const pendingLabel = mode === "username" ? "발송 중..." : "재설정 중...";
  const phoneHint = target === "student"
    ? "학생 본인 또는 학부모 번호로 받을 수 있습니다."
    : "등록된 학부모 번호로 발송됩니다.";

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-recovery-title"
      aria-describedby={successMessage ? "account-recovery-status" : "account-recovery-description"}
      onClick={handleClose}
    >
      <div ref={cardRef} className={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.overlayClose}
          onClick={handleClose}
          aria-label="닫기"
          disabled={pending}
        >
          <X size={18} aria-hidden />
        </button>
        <h2 id="account-recovery-title" className={styles.overlayTitle}>{title}</h2>
        {successMessage ? (
          <p id="account-recovery-status" className={styles.resetSuccess} role="status" aria-live="polite">
            {successMessage}
          </p>
        ) : (
          <>
            <p id="account-recovery-description" className={styles.resetDescription}>
              등록된 정보가 확인되면 입력하신 휴대폰 번호로 안내를 보내드립니다.
            </p>
            <div className={`${styles.signupSegmentWrap} ${styles.resetTargetWrap}`} role="group" aria-label="복구 유형 선택">
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${mode === "username" ? styles.isSelected : ""}`}
                aria-pressed={mode === "username"}
                onClick={() => selectMode("username")}
              >
                아이디
              </button>
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${mode === "password" ? styles.isSelected : ""}`}
                aria-pressed={mode === "password"}
                onClick={() => selectMode("password")}
              >
                비밀번호
              </button>
            </div>
            <div className={`${styles.signupSegmentWrap} ${styles.resetTargetWrap}`} role="group" aria-label="대상 선택">
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${target === "student" ? styles.isSelected : ""}`}
                aria-pressed={target === "student"}
                onClick={() => selectTarget("student")}
              >
                학생
              </button>
              <button
                type="button"
                className={`${styles.signupSegmentBtn} ${target === "parent" ? styles.isSelected : ""}`}
                aria-pressed={target === "parent"}
                onClick={() => selectTarget("parent")}
              >
                학부모
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <input
                ref={studentNameInputRef}
                className={styles.input}
                placeholder="학생 이름 *"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                autoComplete="name"
                aria-label="학생 이름"
              />
              <div className={styles.signupPhoneRow}>
                <span className={styles.signupInputLabel}>
                  휴대폰 번호 <span className={styles.requiredMark}>*</span>
                </span>
                <PhoneInput010Blocks
                  value={phone}
                  onChange={setPhone}
                  blockClassName={styles.signupPhoneBlock}
                  inputClassName={styles.signupPhoneBlockInput}
                  aria-label={target === "student" ? "학생 또는 학부모 휴대폰 번호" : "학부모 휴대폰 번호"}
                />
                <span className={styles.phoneHint}>{phoneHint}</span>
              </div>
              {error && <div className={styles.error} role="alert" aria-live="assertive">{error}</div>}
              <div className={styles.overlayActions}>
                <button type="button" className={styles.btnSecondary} onClick={handleClose} disabled={pending}>취소</button>
                <button type="submit" className={styles.btnPrimary} disabled={pending}>
                  {pending ? pendingLabel : submitLabel}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
