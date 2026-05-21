// PATH: src/app_teacher/domains/profile/pages/ProfilePage.tsx
// 내 프로필 — 프로필 + PWA 설치 + 푸시 알림 설정
import { useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { ICON } from "@/shared/ui/ds";
import { useA2HS } from "@teacher/shared/hooks/useA2HS";
import { usePushSubscription } from "@teacher/shared/hooks/usePushSubscription";
import { Check, ChevronLeft, Download } from "@teacher/shared/ui/Icons";

import styles from "./ProfilePage.module.css";

const ROLE_LABELS: Record<string, string> = {
  owner: "원장",
  admin: "관리자",
  teacher: "강사",
  staff: "직원",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canInstall, isInstalled, promptInstall } = useA2HS();
  const push = usePushSubscription();
  const name = user?.name || "사용자";
  const roleLabel = ROLE_LABELS[user?.tenantRole || ""] || "직원";
  const avatarInitial = Array.from(name)[0] ?? "?";
  const pushBlocked = push.permission === "denied";
  const pushDisabled = push.loading || pushBlocked;
  const pushButtonClass = cx(
    styles.pushButton,
    push.subscribed || pushBlocked ? styles.pushButtonSecondary : styles.pushButtonPrimary,
    push.loading && styles.pushButtonLoading,
    pushBlocked && styles.pushButtonBlocked,
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={styles.title}>
          프로필
        </h1>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {avatarInitial}
        </div>
        <div className={styles.profileText}>
          <div className={styles.name}>{name}</div>
          <div className={styles.role}>{roleLabel}</div>
        </div>
      </div>

      <div className={styles.infoCard}>
        {user?.username && (
          <div className={cx(styles.infoRow, styles.infoRowBorder)}>
            <span className={styles.infoLabel}>아이디</span>
            <span className={styles.infoValue}>{user.username}</span>
          </div>
        )}
        {user?.phone && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>전화</span>
            <span className={styles.infoValue}>{user.phone}</span>
          </div>
        )}
      </div>

      {/* PWA 설치 카드 */}
      {canInstall && (
        <button
          type="button"
          onClick={promptInstall}
          className={styles.installButton}
        >
          <div className={styles.installIcon}>
            <Download size={ICON.md} />
          </div>
          <div className={styles.installBody}>
            <div className={styles.installTitle}>
              홈 화면에 추가
            </div>
            <div className={styles.installDesc}>
              앱처럼 빠르게 접근할 수 있습니다
            </div>
          </div>
        </button>
      )}

      {isInstalled && (
        <div className={styles.installedBanner}>
          <Check size={ICON.sm} className={styles.installedIcon} />
          <span className={styles.installedText}>
            앱이 설치되어 있습니다
          </span>
        </div>
      )}

      {/* 푸시 알림 설정 */}
      {push.supported && (
        <div className={styles.pushCard}>
          <div className={styles.pushHeader}>
            <div>
              <div className={styles.pushTitle}>
                푸시 알림
              </div>
              <div className={styles.pushDesc}>
                {push.subscribed
                  ? "새 알림을 푸시로 받고 있습니다"
                  : "알림을 놓치지 않도록 푸시를 켜보세요"}
              </div>
            </div>
            <button
              type="button"
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
              disabled={pushDisabled}
              className={pushButtonClass}
            >
              {push.loading ? "..." : push.permission === "denied" ? "차단됨" : push.subscribed ? "끄기" : "켜기"}
            </button>
          </div>
          {push.permission === "denied" && (
            <div className={styles.deniedMessage}>
              브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={styles.backButton}>
      <ChevronLeft size={ICON.md} />
    </button>
  );
}
