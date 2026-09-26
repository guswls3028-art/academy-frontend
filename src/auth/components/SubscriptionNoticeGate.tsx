import { useEffect, useState, useSyncExternalStore } from "react";
import type { User, SubscriptionNotice } from "@/auth/context/AuthContext";
import {
  consumeSubscriptionNoticeLogin,
  readSubscriptionNoticeLogin,
} from "@/auth/subscriptionNoticeLogin";
import {
  hasPendingStaffClockInChoice,
  subscribeStaffClockInChoice,
} from "@/features/staff-clock/promptSession";
import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import styles from "./SubscriptionNoticeGate.module.css";

function SubscriptionNoticeDialog({ notice }: {
  notice: SubscriptionNotice | null;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!notice) setOpen(false);
  }, [notice]);
  if (!notice) return null;

  return (
    <AdminModal
      open={open}
      onClose={() => setOpen(false)}
      onEnterConfirm={() => setOpen(false)}
      width={460}
      noMinimize
      className={styles.dialog}
    >
      <ModalHeader title="이용기간 안내" noIcon description="이용기간이 지났습니다. 결제 내역을 확인해주세요." />
      <ModalBody>
        <dl className={styles.dates}>
          <div><dt>이용기간 종료일</dt><dd>{notice.subscription_expires_at}</dd></div>
          <div><dt>서비스 이용 가능 기한</dt><dd>{notice.service_access_expires_at}</dd></div>
        </dl>
        <p className={styles.summary}>이용기간 종료 후 {notice.days_overdue}일이 지났으며, 이용 가능 기간은 {notice.days_remaining}일 남았습니다.</p>
        <p className={styles.help}>안내를 닫고 계속 이용할 수 있습니다. 결제 확인은 학원 담당자에게 문의해 주세요.</p>
      </ModalBody>
      <ModalFooter right={<Button intent="primary" size="lg" onClick={() => setOpen(false)}>확인</Button>} />
    </AdminModal>
  );
}

export default function SubscriptionNoticeGate({ user, tenantCode }: { user: User; tenantCode: string }) {
  // Capture without consuming during render so StrictMode cannot lose a login.
  const [generation] = useState(() => readSubscriptionNoticeLogin(tenantCode));
  const [loginNotice] = useState(user.subscription_notice);
  useEffect(() => {
    if (generation) consumeSubscriptionNoticeLogin(generation);
  }, [generation]);
  const clockInPending = useSyncExternalStore(subscribeStaffClockInChoice, hasPendingStaffClockInChoice, () => false);
  if (!generation || generation !== readActiveAuthGenerationSafely()
    || !["owner", "admin", "teacher", "staff"].includes(user.tenantRole ?? "")
    || !loginNotice || (user.tenantRole === "staff" && clockInPending)) return null;

  return <SubscriptionNoticeDialog notice={user.subscription_notice ?? null} />;
}
