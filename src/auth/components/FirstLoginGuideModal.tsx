import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "@/shared/api/axios";
import type { TenantRole } from "@/auth/context/AuthContext";
import styles from "./FirstLoginGuideModal.module.css";

type FirstLoginGuideModalProps = {
  username: string;
  role: TenantRole;
  tenantCode: string;
  primaryColor?: string;
  onCompleted: () => void;
};

type GuideAction = "close" | "settings";

function displayUsername(username: string): string {
  return username.replace(/^t\d+_/, "").replace(/^p_\d+_/, "");
}

function settingsPath(role: TenantRole, pathname: string): string {
  if (role === "student" || role === "parent") {
    return "/student/profile";
  }
  return pathname.startsWith("/workspace/mobile")
    ? "/workspace/mobile/settings"
    : "/workspace/settings/profile";
}

function contrastColor(color: string | undefined): string {
  const match = color?.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return "#ffffff";
  const value = match[1];
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return luminance >= 150 ? "#172033" : "#ffffff";
}

export default function FirstLoginGuideModal({
  username,
  role,
  tenantCode,
  primaryColor,
  onCompleted,
}: FirstLoginGuideModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<(action: GuideAction) => Promise<void>>(async () => {});
  const [pendingAction, setPendingAction] = useState<GuideAction | null>(null);
  const [error, setError] = useState("");
  const destination = settingsPath(role, location.pathname);
  const loginId = useMemo(() => displayUsername(username), [username]);
  const accentStyle = {
    "--first-guide-accent": primaryColor || "var(--color-brand-primary, #2563eb)",
    "--first-guide-accent-contrast": contrastColor(primaryColor),
  } as CSSProperties;

  const complete = async (action: GuideAction) => {
    if (pendingAction) return;
    setPendingAction(action);
    setError("");
    try {
      await api.post("/core/me/first-login-guide/complete/");
    } catch {
      setError("안내 확인을 저장하지 못했습니다. 다시 시도해 주세요.");
      setPendingAction(null);
      return;
    }

    if (action === "settings") {
      navigate(destination);
    }
    onCompleted();
  };
  completeRef.current = complete;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void completeRef.current("close");
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div
      className={styles.overlay}
      data-first-login-tenant={tenantCode}
      style={accentStyle}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-guide-title"
        aria-describedby="first-login-guide-description"
      >
        <div className={styles.accent} aria-hidden="true" />
        <button
          type="button"
          className={styles.closeButton}
          aria-label="계정 안내 닫기"
          onClick={() => void complete("close")}
          disabled={pendingAction !== null}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M5 20h14a2 2 0 0 0 2-2V8l-6-5H7a2 2 0 0 0-2 2v15Z" />
              <path d="M9 3v5h6V3M9 13h6M9 17h4" />
            </svg>
          </span>
          <div>
            <h1 id="first-login-guide-title" className={styles.title}>계정 안내</h1>
            <p id="first-login-guide-description" className={styles.description}>
              처음 접속할 때 한 번만 표시됩니다.
            </p>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.accountCard}>
            <span className={styles.accountLabel}>로그인 아이디</span>
            <strong className={styles.accountValue}>{loginId}</strong>
          </div>

          <div className={styles.guideList}>
            <div className={styles.guideItem}>
              <span className={styles.itemIcon} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <div>
                <strong>비밀번호</strong>
                <p>필요할 때 내 정보에서 언제든 변경할 수 있습니다.</p>
              </div>
            </div>
            <div className={styles.guideItem}>
              <span className={styles.itemIcon} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1.1-1.52 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1.1 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.63.65 1.1 1.29 1.1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
                </svg>
              </span>
              <div>
                <strong>기본 설정</strong>
                <p>프로필과 화면 설정도 같은 메뉴에서 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>

          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void complete("settings")}
            disabled={pendingAction !== null}
          >
            {pendingAction === "settings" ? "이동 중…" : "내 정보 열기"}
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            className={styles.primaryButton}
            onClick={() => void complete("close")}
            disabled={pendingAction !== null}
          >
            {pendingAction === "close" ? "확인 중…" : "확인"}
          </button>
        </footer>
      </div>
    </div>
  );
}
