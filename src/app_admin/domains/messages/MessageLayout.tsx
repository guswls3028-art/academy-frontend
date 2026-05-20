// PATH: src/app_admin/domains/messages/MessageLayout.tsx
// 메시지 — DomainLayout 탭 SSOT

import { Outlet, Link } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import styles from "./MessageLayout.module.css";

const MESSAGE_TABS: DomainTab[] = [
  { key: "templates", label: "템플릿 저장", path: "/admin/message/templates" },
  { key: "auto-send", label: "자동발송", path: "/admin/message/auto-send" },
  { key: "log", label: "발송 내역", path: "/admin/message/log" },
  { key: "settings", label: "설정", path: "/admin/message/settings" },
];

export default function MessageLayout() {
  const { data: info } = useMessagingInfo();
  const smsConnected = info?.sms_allowed ?? false;

  return (
    <DomainLayout
      title="메시지"
      description="템플릿 · 자동발송 · 발송 내역 · 설정"
      tabs={MESSAGE_TABS}
    >
      {!smsConnected && info && (
        <div className={styles.smsNotice}>
          <span>SMS 미연동 — 알림톡만 발송 가능</span>
          <Link
            to="/admin/message/settings"
            className={styles.smsNoticeLink}
          >
            연동하기 →
          </Link>
        </div>
      )}
      <Outlet />
    </DomainLayout>
  );
}
