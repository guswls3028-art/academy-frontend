import { useMemo, useState } from "react";
import { Bell, BellOff, BellRing, Smartphone, X } from "lucide-react";

import { ICON } from "@/shared/ui/ds";
import { usePushSubscription } from "@/shared/pwa/usePushSubscription";

import styles from "./DevPushControl.module.css";

export function DevPushControl() {
  const push = usePushSubscription({
    endpointPrefix: "/teacher-app/push/platform",
  });
  const [showGuide, setShowGuide] = useState(false);
  const device = useMemo(() => {
    const userAgent = navigator.userAgent;
    return {
      isIos: /iPad|iPhone|iPod/.test(userAgent),
      isStandalone:
        window.matchMedia("(display-mode: standalone)").matches
        || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    };
  }, []);

  const needsIosInstall = device.isIos && !device.isStandalone;
  const blocked = push.permission === "denied";

  async function handleToggle() {
    if (needsIosInstall || !push.supported || blocked) {
      setShowGuide(true);
      return;
    }
    if (push.subscribed) {
      const success = await push.unsubscribe();
      if (!success) setShowGuide(true);
    } else {
      const success = await push.subscribe();
      if (!success) setShowGuide(true);
    }
  }

  const label = push.loading
    ? "알림 확인 중"
    : push.subscribed
      ? "알림 켜짐"
      : needsIosInstall
        ? "iPhone 알림 설정"
        : blocked
          ? "알림 차단됨"
          : "알림 켜기";
  const Icon = push.subscribed ? BellRing : blocked ? BellOff : Bell;

  return (
    <div className={styles.control}>
      <button
        type="button"
        className={styles.button}
        data-active={push.subscribed ? "true" : undefined}
        onClick={handleToggle}
        disabled={push.loading}
        aria-expanded={showGuide}
      >
        <Icon size={ICON.sm} />
        {label}
      </button>

      {showGuide && (
        <div className={styles.guide} role="status">
          <button
            type="button"
            className={styles.close}
            onClick={() => setShowGuide(false)}
            aria-label="안내 닫기"
          >
            <X size={ICON.xs} />
          </button>
          <div className={styles.guideIcon}>
            <Smartphone size={ICON.md} />
          </div>
          <div>
            <strong>
              {blocked ? "iPhone 알림 허용이 필요합니다" : "홈 화면 앱에서 알림을 켜세요"}
            </strong>
            {blocked ? (
              <p>iPhone 설정에서 ‘학원플러스 콘솔’ 알림을 허용한 뒤 다시 열어 주세요.</p>
            ) : needsIosInstall ? (
              <ol>
                <li>Safari 하단의 공유 버튼을 누릅니다.</li>
                <li>‘홈 화면에 추가’를 선택합니다.</li>
                <li>추가된 학원플러스 아이콘으로 열고 ‘알림 켜기’를 누릅니다.</li>
              </ol>
            ) : (
              <p>
                {push.error
                  || (push.permission === "default"
                    ? "알림 권한 팝업에서 ‘허용’을 선택해 주세요."
                    : "이 브라우저에서는 웹 앱 푸시 알림을 사용할 수 없습니다.")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
