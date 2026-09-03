import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle2, Clock3, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";

import {
  fetchNotificationLog,
  fetchNotificationLogDetail,
  fetchScheduledNotifications,
  type NotificationLogItem,
  type ScheduledNotificationItem,
  clinicMessageHistoryQueryKeys,
} from "@admin/domains/messages/public/clinicMessageHistory";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./ClinicMessageHistoryPanel.module.css";

type HistoryState =
  | "scheduled"
  | "pending"
  | "dispatching"
  | "provider_accepted"
  | "delivered"
  | "failed"
  | "cancelled"
  | "skipped";

type HistoryRow = {
  key: string;
  logId?: number;
  state: HistoryState;
  label: string;
  title: string;
  recipient: string;
  timestamp: string;
  detail: string;
  canVerify: boolean;
};

const SKIPPED_FAILURE_CODES = new Set([
  "template_unavailable",
  "policy_blocked",
  "recipient_blocked",
  "messaging_disabled",
]);

const STATE_LABELS: Record<HistoryState, string> = {
  scheduled: "예약",
  pending: "대기",
  dispatching: "전송 중",
  provider_accepted: "공급사 접수",
  delivered: "최종 전달",
  failed: "실패",
  cancelled: "취소",
  skipped: "발송 안 함",
};

function scheduledState(item: ScheduledNotificationItem): HistoryState {
  if (item.status === "cancelled") return "cancelled";
  if (item.status === "failed") return "failed";
  if (item.status === "dispatching" || item.status === "sent") return "dispatching";
  return dayjs(item.send_at).isAfter(dayjs()) ? "scheduled" : "pending";
}

function logState(item: NotificationLogItem): HistoryState {
  if (SKIPPED_FAILURE_CODES.has(item.failure_code ?? "")) return "skipped";
  if (item.provider_delivery_status === "delivered") return "delivered";
  if (item.provider_delivery_status === "failed") return "failed";
  if (item.provider_delivery_status === "provider_accepted") return "provider_accepted";
  if (item.status === "sending") return "dispatching";
  if (item.status === "processing" || item.status === "retryable_failed" || item.status === "ambiguous") {
    return "pending";
  }
  if (item.status === "sent" && item.provider_evidence) return "provider_accepted";
  if (item.status === "failed" || item.success === false) return "failed";
  return "pending";
}

function scheduledRow(item: ScheduledNotificationItem): HistoryRow {
  const state = scheduledState(item);
  return {
    key: `scheduled-${item.id}`,
    state,
    label: STATE_LABELS[state],
    title: item.message_preview || item.trigger || "클리닉 알림톡",
    recipient: item.recipient_summary || "수신자 확인 필요",
    timestamp: item.sent_at || item.send_at || item.created_at,
    detail: item.error_message || (state === "scheduled" ? "예약 시각에 발송 대기열로 이동합니다." : "발송 처리 상태를 확인하고 있습니다."),
    canVerify: false,
  };
}

function logRow(item: NotificationLogItem): HistoryRow {
  const state = logState(item);
  const checkedAt = item.provider_delivery_checked_at;
  const detail = item.provider_delivery_failure_reason
    || item.failure_reason
    || (state === "provider_accepted"
      ? "공급사가 요청을 접수했습니다. 최종 전달 여부는 별도로 확인할 수 있습니다."
      : state === "delivered"
        ? `공급사 최종 전달 확인${checkedAt ? ` · ${dayjs(checkedAt).format("M/D HH:mm")}` : ""}`
        : state === "pending"
          ? "아직 공급사 접수 또는 최종 결과가 확인되지 않았습니다."
          : "알림톡 처리 기록입니다.");
  return {
    key: `log-${item.id}`,
    logId: item.id,
    state,
    label: STATE_LABELS[state],
    title: item.template_summary || item.notification_type || "클리닉 알림톡",
    recipient: item.recipient_summary || item.target_name || "수신자 정보 제한",
    timestamp: item.provider_delivery_updated_at || item.sent_at,
    detail,
    canVerify: state === "provider_accepted" && Boolean(item.provider_evidence),
  };
}

export default function ClinicMessageHistoryPanel() {
  const logsQ = useQuery({
    queryKey: clinicMessageHistoryQueryKeys.logs,
    queryFn: () => fetchNotificationLog({ scope: "clinic", page_size: 20 }),
    staleTime: 30_000,
  });
  const scheduledQ = useQuery({
    queryKey: clinicMessageHistoryQueryKeys.scheduled,
    queryFn: () => fetchScheduledNotifications({ scope: "clinic", page_size: 20 }),
    staleTime: 30_000,
  });
  const [verifiedLogs, setVerifiedLogs] = useState<Record<number, NotificationLogItem>>({});
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const logRows = (logsQ.data?.results ?? []).map((item) => logRow(verifiedLogs[item.id] ?? item));
    const scheduledRows = (scheduledQ.data?.results ?? []).map(scheduledRow);
    return [...logRows, ...scheduledRows]
      .sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
  }, [logsQ.data, scheduledQ.data, verifiedLogs]);

  const refresh = () => {
    void logsQ.refetch();
    void scheduledQ.refetch();
  };

  const verify = async (logId: number) => {
    setVerifyingId(logId);
    try {
      const detail = await fetchNotificationLogDetail(logId, { verify_provider: true });
      setVerifiedLogs((current) => ({ ...current, [logId]: detail }));
    } catch {
      feedback.error("공급사 최종 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setVerifyingId(null);
    }
  };

  const loading = logsQ.isLoading || scheduledQ.isLoading;
  const error = logsQ.isError || scheduledQ.isError;

  return (
    <section className={styles.panel} aria-labelledby="clinic-message-history-title">
      <header className={styles.header}>
        <div>
          <p>DELIVERY EVIDENCE</p>
          <h2 id="clinic-message-history-title">클리닉 알림톡 기록</h2>
          <span>예약부터 공급사 접수와 최종 전달까지, 서로 다른 상태를 구분해 표시합니다.</span>
        </div>
        <Button
          intent="ghost"
          size="sm"
          leftIcon={<RefreshCcw size={ICON_FOR_BUTTON.sm} />}
          onClick={refresh}
          disabled={logsQ.isFetching || scheduledQ.isFetching}
        >
          새로고침
        </Button>
      </header>

      <div className={styles.policy} role="note">
        <ShieldCheck size={18} aria-hidden />
        <span>
          <strong>하원 알림톡도 예약·등원과 같은 승인된 클리닉 안내 양식으로 발송합니다.</strong>
          승인된 양식의 고정 문구·변수는 읽기 전용이며, 공급사가 허용한 안내 영역만 수정할 수 있습니다.
        </span>
      </div>

      {loading ? (
        <div className={styles.state}><Clock3 size={20} aria-hidden />기록을 불러오는 중입니다.</div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <TriangleAlert size={20} aria-hidden />기록을 불러오지 못했습니다.
          <Button intent="secondary" size="sm" onClick={refresh}>다시 불러오기</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.state}>아직 클리닉 알림톡 기록이 없습니다.</div>
      ) : (
        <ol className={styles.list} aria-label="클리닉 알림톡 상태 기록">
          {rows.map((row) => (
            <li key={row.key} className={styles.row} data-state={row.state}>
              <span className={styles.mark} aria-hidden>
                {row.state === "delivered" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
              </span>
              <div className={styles.copy}>
                <div className={styles.rowTitle}>
                  <span className={styles.badge}>{row.label}</span>
                  <strong>{row.title}</strong>
                </div>
                <p>{row.detail}</p>
                <span>{row.recipient} · {dayjs(row.timestamp).format("YYYY.M.D HH:mm")}</span>
              </div>
              {row.canVerify && row.logId && (
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => void verify(row.logId!)}
                  disabled={verifyingId === row.logId}
                >
                  {verifyingId === row.logId ? "확인 중…" : "최종 상태 확인"}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
