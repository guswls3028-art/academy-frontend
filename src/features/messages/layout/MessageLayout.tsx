// PATH: src/features/messages/layout/MessageLayout.tsx
// 메시지 — students 도메인 디자인 기반 (StorageStyleTabs)

import { Outlet, Link } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { StorageStyleTabs } from "@/shared/ui/domain";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";
import styles from "@/shared/ui/domain/StorageStyleTabs.module.css";

const MESSAGE_TABS = [
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
    >
      {!smsConnected && info && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 16px",
            marginBottom: 12,
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--color-status-warning, #d97706) 8%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-status-warning, #d97706) 25%, var(--color-border-divider))",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
          }}
        >
          <span>현재 계정은 SMS 미연동 상태로 알림톡만 발송 가능합니다.</span>
          <Link
            to="/admin/message/settings"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-status-warning, #d97706)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            연동하러 가기 →
          </Link>
        </div>
      )}
      <div className={styles.wrap}>
        <StorageStyleTabs tabs={MESSAGE_TABS} />
        <Outlet />
      </div>
    </DomainLayout>
  );
}
