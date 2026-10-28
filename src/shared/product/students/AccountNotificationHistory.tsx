import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchStudentAccountNotifications, sendStudentAccountGuidance, verifyAccountNotificationDelivery,
  type ClientAccountNotificationLog,
} from "@/shared/api/contracts/students";
import { Badge, Button } from "@/shared/ui/ds";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./AccountNotificationHistory.module.css";

const labels: Record<string, string> = {
  registration_approved_student: "학생 로그인 정보 안내",
  registration_approved_parent: "학부모 로그인 정보 안내",
  password_reset_student: "학생 비밀번호 안내",
  password_reset_parent: "학부모 비밀번호 안내",
  password_find_otp: "계정 인증 안내",
};

function DeliveryRow({ studentId, log }: { studentId: number; log: ClientAccountNotificationLog }) {
  const verification = useQuery({
    queryKey: notificationQueryKeys.accountDelivery(studentId, log.id),
    queryFn: () => verifyAccountNotificationDelivery(log.id),
    enabled: false,
    retry: false,
  });
  const final = verification.isError ? undefined : verification.data;
  const status = final?.provider_delivery_status;
  const admissionFailed = log.status === "failed" || (log.status === "sent" && !log.success);
  const failed = status === "failed" || (!final && admissionFailed);
  const label = status === "delivered" ? "최종 전달 성공"
    : status === "failed" ? "최종 전달 실패"
    : status === "unavailable" ? "최종 전달 확인 불가"
    : status === "provider_accepted" ? "최종 결과 대기"
    : log.status === "ambiguous" ? "결과 확인 필요"
    : admissionFailed ? "발송 실패"
    : log.status === "retryable_failed" ? "재시도 대기"
    : ["processing", "sending"].includes(log.status) ? "처리 중"
    : log.success ? "발송 접수" : "결과 확인 필요";
  return (
    <li className={styles.row}>
      <div className={styles.rowHeading}>
        <strong>{labels[log.notificationType] || "계정 안내"}</strong>
        <Badge tone={failed ? "danger" : status === "delivered" ? "success" : "neutral"}>{label}</Badge>
      </div>
      <div className={styles.meta}>
        {log.sentAt ? new Date(log.sentAt).toLocaleString("ko-KR") : "접수 시각 확인 중"}
        {log.recipientSummary && <span> · {log.recipientSummary}</span>}
      </div>
      {failed && <p className={styles.error}>{final?.provider_delivery_failure_reason || log.failureReason || "발송 결과를 확인해 주세요."}</p>}
      {status === "unavailable" && <p>{final?.provider_delivery_failure_reason || "최종 전달 정보를 확인할 수 없습니다. 접수 기록은 유지됩니다."}</p>}
      {verification.isError && <p role="alert" className={styles.error}>최종 결과를 불러오지 못했습니다. 다시 확인해 주세요.</p>}
      <div className={styles.actions}>
        <Button intent="ghost" size="sm" disabled={verification.isFetching} onClick={() => void verification.refetch()}>
          {verification.isFetching ? "확인 중…" : "최종 전달 확인"}
        </Button>
        {final?.provider_status_code && <span className={styles.meta}>결과 코드 {final.provider_status_code}</span>}
      </div>
      {final?.provider_delivery_checked_at && <div className={styles.meta}>확인 시각 {new Date(final.provider_delivery_checked_at).toLocaleString("ko-KR")}</div>}
    </li>
  );
}

export default function AccountNotificationHistory({ studentId, queryKey }: {
  studentId: number; queryKey: readonly unknown[];
}) {
  const history = useQuery({ queryKey, queryFn: () => fetchStudentAccountNotifications(studentId, 10), retry: false });
  const [notice, setNotice] = useState("");
  const retry = useMutation({
    mutationFn: () => sendStudentAccountGuidance(studentId, "initial"),
    onMutate: () => setNotice(""),
    onSuccess: (result) => setNotice(result.message),
    onSettled: () => { void history.refetch(); },
  });
  const initial = history.data?.initialNotice;
  return (
    <section className={styles.history} aria-label="계정 안내 발송 내역">
      <p className={styles.policy}>신규 학생의 첫 수강 확정 시 계정 안내를 요청합니다. 기존 학생의 추가 수강에는 자동으로 다시 보내지 않습니다.</p>
      <p className={styles.policy}>발송 접수는 수신 완료와 다릅니다. 각 내역의 최종 전달 확인에서 결과를 확인해 주세요.</p>
      <div className={styles.actions}>
        <Button intent="ghost" size="sm" disabled={history.isFetching} onClick={() => void history.refetch()}>내역 새로고침</Button>
      </div>
      {history.isLoading ? <p role="status">계정 안내 이력을 불러오는 중…</p>
        : history.isError ? <div role="alert" className={styles.error}>계정 안내 이력을 불러오지 못했습니다. <Button intent="ghost" size="sm" onClick={() => void history.refetch()}>다시 시도</Button></div>
        : <>
          {initial && <div className={styles.initial}>
            <p>{initial.message}</p>
            {initial.status === "action_required" && <Button intent="secondary" size="sm" disabled={retry.isPending} onClick={() => retry.mutate()}>
              {retry.isPending ? "요청 중…" : "최초 안내 다시 요청"}
            </Button>}
          </div>}
          {!history.data?.results.length ? <p>최근 아이디/비밀번호 알림톡 이력이 없습니다. 요청 직후라면 내역을 새로고침해 주세요.</p>
            : <ul className={styles.list}>{history.data.results.map(log => <DeliveryRow key={log.id} studentId={studentId} log={log} />)}</ul>}
        </>}
      {notice && <p role="status">{notice}</p>}
      {retry.isError && <p role="alert" className={styles.error}>{extractApiError(retry.error, "최초 안내 요청에 실패했습니다. 다시 시도해 주세요.")}</p>}
    </section>
  );
}
