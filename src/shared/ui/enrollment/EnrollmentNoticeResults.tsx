import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRegistrationReceipt, verifyRegistrationNotice, type RecipientNotice, type RegistrationDelivery } from "@/shared/api/contracts/registrationNotices";
import { notificationQueryKeys } from "@/shared/api/queryKeys/notifications";
import { Button } from "@/shared/ui/ds";
import { useRegistrationScope } from "./useNoticeRegistration";
import styles from "./EnrollmentNotices.module.css";

const labels: Record<RecipientNotice["status"], string> = {
  skipped: "선택에 따라 미발송", not_first: "첫 수강 대상 아님 · 미발송", no_recipient: "연락처 없음 · 미발송",
  shared_recipient: "같은 번호 · 학부모 안내에 포함", queued: "발송 대기", processing: "발송 처리 중",
  accepted: "발송 접수 · 최종 전달 대기", failed: "발송 실패", ambiguous: "발송 결과 확인 필요", delivered: "최종 전달 성공",
};
const verifiedLabels: Record<string, string> = {
  unavailable: "최종 전달 확인 불가", provider_accepted: "발송 접수 · 최종 전달 대기",
  delivered: "최종 전달 성공", failed: "최종 전달 실패",
};

function Recipient({ role, notice, lecture, requestId }: {
  role: string; notice: RecipientNotice; lecture: number; requestId: string;
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState<RegistrationDelivery | null>(null);
  async function verify() {
    if (!notice.log_id || checking) return;
    setChecking(true);
    setError(false);
    try { setVerified(await verifyRegistrationNotice(lecture, requestId, notice.log_id)); }
    catch { setError(true); }
    finally { setChecking(false); }
  }
  const terminal = notice.status === "delivered" || notice.status === "failed";
  const verifiedTerminal = verified?.provider_delivery_status === "failed" || verified?.provider_delivery_status === "delivered";
  const final = terminal && !verifiedTerminal ? null : verified;
  return <div role="group" aria-label={role} className={styles.recipient}>
    <span>{role}</span>
    <strong aria-live="polite">{(final ? verifiedLabels[final.provider_delivery_status] : labels[notice.status]) ?? "발송 결과 확인 필요"}</strong>
    {notice.log_id != null && <Button type="button" size="sm" intent="ghost" disabled={checking} onClick={() => void verify()}>
      {checking ? "확인 중…" : "최종 전달 확인"}
    </Button>}
    {final?.provider_delivery_failure_reason && <small>{final.provider_delivery_failure_reason}</small>}
    {error && <small role="alert">최종 결과를 불러오지 못했습니다. 다시 확인해 주세요.</small>}
  </div>;
}

export default function EnrollmentNoticeResults({ lecture }: { lecture: number }) {
  const scope = useRegistrationScope(lecture);
  const polling = useRef({ requestId: "", until: 0 });
  const result = useQuery({
    queryKey: notificationQueryKeys.registration(scope),
    queryFn: async () => {
      const receipt = await fetchRegistrationReceipt(lecture);
      if (receipt && polling.current.requestId !== receipt.request_id) {
        polling.current = { requestId: receipt.request_id, until: Date.now() + 120_000 };
      }
      return receipt;
    },
    enabled: !!scope,
    retry: false,
    refetchInterval: query => {
      const receipt = query.state.data;
      if (query.state.error || !receipt || (polling.current.requestId === receipt.request_id && Date.now() >= polling.current.until)) return false;
      return receipt.students.some(row => [row.student, row.parent].some(r => r.status === "queued" || r.status === "processing"))
        ? 15_000 : false;
    },
  });
  if (!scope || (!result.data && !result.isError)) return null;
  const receipt = result.data;
  return <section className={styles.results} aria-label="최근 등록 알림톡 결과">
    <div className={styles.heading}>
      <h3>최근 등록 알림톡 결과</h3>
      <Button type="button" size="sm" intent="ghost" disabled={result.isFetching} onClick={() => {
        polling.current.until = Date.now() + 120_000;
        void result.refetch();
      }}>
        {result.isFetching ? "조회 중…" : "발송 상태 새로고침"}
      </Button>
    </div>
    {result.isError && <p role="alert">발송 상태를 갱신하지 못했습니다. 다시 조회해 주세요.</p>}
    {receipt && <ul key={receipt.request_id} aria-label="학생별 발송 결과" tabIndex={0} className={styles.rows}>
      {receipt.students.map(row => <li key={row.id} className={styles.row} aria-label={row.name}>
        <b>{row.name}</b>
        <Recipient key={`student-${row.student.log_id}`} role="학생" notice={row.student} lecture={lecture} requestId={receipt.request_id} />
        <Recipient key={`parent-${row.parent.log_id}`} role="학부모" notice={row.parent} lecture={lecture} requestId={receipt.request_id} />
      </li>)}
    </ul>}
  </section>;
}
