// PATH: src/app_admin/domains/messages/MessageLayout.tsx
// 메시지 — DomainLayout 탭 SSOT

import { Outlet, Link, useNavigate } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import styles from "./MessageLayout.module.css";

const MESSAGE_TABS: DomainTab[] = [
  { key: "templates", label: "문구 저장", path: "/workspace/message/templates" },
  { key: "auto-send", label: "자동발송", path: "/workspace/message/auto-send" },
  { key: "log", label: "발송 내역", path: "/workspace/message/log" },
  { key: "settings", label: "설정", path: "/workspace/message/settings" },
];

export default function MessageLayout() {
  const navigate = useNavigate();
  const {
    data: info,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useMessagingInfo();
  const alimtalkAvailable = Boolean(info?.alimtalk_available);
  const actionDisabledReason = (() => {
    if (isLoading || isFetching) return "알림톡 상태를 확인하고 있습니다.";
    if (isError) return "알림톡 상태를 확인할 수 없습니다.";
    if (alimtalkAvailable) return undefined;
    if (info?.messaging_disabled) {
      return info.messaging_disabled_reason || "알림톡 발송이 운영 중지되었습니다.";
    }
    return "알림톡 발송 준비 상태를 확인해 주세요.";
  })();

  return (
    <DomainLayout
      title="메시지"
      description="알림톡 문구 · 자동발송 · 발송 내역 · 설정"
      tabs={MESSAGE_TABS}
      headerActions={
        <Button
          intent="primary"
          disabled={Boolean(actionDisabledReason)}
          title={actionDisabledReason}
          onClick={() => navigate("/workspace/students/home?compose=alimtalk")}
        >
          알림톡 보내기
        </Button>
      }
    >
      {isError && (
        <div className={styles.alimtalkNotice} role="alert">
          <span>알림톡 상태를 불러오지 못했습니다.</span>
          <Button intent="secondary" size="sm" onClick={() => void refetch()}>
            다시 확인
          </Button>
        </div>
      )}
      {!alimtalkAvailable && info && (
        <div className={styles.alimtalkNotice}>
          <span>{info.messaging_disabled ? info.messaging_disabled_reason || "알림톡 발송이 운영 중지되었습니다" : "알림톡 발송 준비 상태를 확인해 주세요"}</span>
          <Link
            to="/workspace/message/settings"
            className={styles.alimtalkNoticeLink}
          >
            설정 보기 →
          </Link>
        </div>
      )}
      <Outlet />
    </DomainLayout>
  );
}
