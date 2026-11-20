import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router";

import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { clinicBookingRangeText } from "@/shared/ui/clinic/clinicTimeRange";
import { extractApiError } from "@/shared/utils/extractApiError";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import { remindClinicParticipant, type ClinicParticipant, type ClinicRecipient } from "../api/clinicParticipants.api";

type Outcome = {
  state: "accepted" | "partial" | "failed" | "excluded" | "review";
  message: string;
};

type Props = {
  rows: ClinicParticipant[];
  dateLabel: string;
  onClose: () => void;
  onRequested: () => void;
};

const RECIPIENTS: { value: ClinicRecipient; label: string }[] = [
  { value: "student", label: "학생" },
  { value: "parent", label: "학부모" },
  { value: "both", label: "학생·학부모" },
];

function isRetryable(outcome?: Outcome) {
  return outcome?.state === "failed" || outcome?.state === "partial";
}

export default function ClinicBulkReminderDialog({ rows, dateLabel, onClose, onRequested }: Props) {
  const [perStudent] = useState(() => {
    const counts = new Map<number, number>();
    for (const row of rows) counts.set(row.student, (counts.get(row.student) ?? 0) + 1);
    return counts;
  });
  const [selected, setSelected] = useState(() =>
    new Map(rows.filter((row) => perStudent.get(row.student) === 1).map((row) => [row.student, row.id])),
  );
  const [recipient, setRecipient] = useState<ClinicRecipient>("student");
  const [outcomes, setOutcomes] = useState<Map<number, Outcome>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const pending = useRef(false);

  const selectedRows = rows.filter((row) => selected.get(row.student) === row.id);
  const retryCount = selectedRows.filter((row) => isRetryable(outcomes.get(row.id))).length;
  const accepted = [...outcomes.values()].filter((outcome) => outcome.state === "accepted").length;
  const excluded = [...outcomes.values()].filter((outcome) => outcome.state === "excluded").length;
  const reviewCount = [...outcomes.values()].filter((outcome) => outcome.state === "review").length;
  const hasMultiple = rows.length > perStudent.size;

  async function send() {
    if (pending.current) return;
    const targets = submitted ? selectedRows.filter((row) => isRetryable(outcomes.get(row.id))) : selectedRows;
    if (!targets.length) return;
    const batchKey = requestId.current ?? createRandomUuid();
    requestId.current = batchKey;
    pending.current = true;
    setBusy(true);
    setSubmitted(true);

    let cursor = 0;
    async function sendNext() {
      while (cursor < targets.length) {
        const row = targets[cursor++];
        let outcome: Outcome;
        try {
          const result = await remindClinicParticipant(row.id, { send_to: recipient, mode: "once", request_id: batchKey });
          if (result.skipped === 0) {
            outcome = { state: "accepted", message: "알림톡 요청 접수" };
          } else if (result.retryable === false) {
            outcome = { state: "review", message: "일부 접수 · 발송 내역에서 결과를 확인해 주세요." };
          } else {
            outcome = { state: "partial", message: "일부 접수 · 수신자 전화번호와 알림 설정을 확인해 주세요." };
          }
        } catch (error) {
          const response = isAxiosError<{ retryable?: boolean }>(error) ? error.response : undefined;
          if (response?.status === 404 || response?.status === 409) {
            outcome = { state: "excluded", message: "예약 또는 출결이 바뀌어 제외했습니다." };
          } else if (response?.data?.retryable === false) {
            outcome = { state: "review", message: "발송 내역에서 이전 요청의 결과를 확인해 주세요." };
          } else {
            outcome = { state: "failed", message: extractApiError(error, "접수를 확인하지 못했습니다. 이 대상만 다시 시도할 수 있습니다.") };
          }
        }
        setOutcomes((current) => new Map(current).set(row.id, outcome));
      }
    }

    try {
      // A few concurrent requests keep the page responsive without flooding the messaging API.
      await Promise.all(Array.from({ length: Math.min(5, targets.length) }, sendNext));
      onRequested();
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return (
    <AdminModal
      open
      onClose={() => { if (!pending.current) onClose(); }}
      onEnterConfirm={() => undefined}
      width={540}
      noMinimize
      trapFocus
      closeDisabled={busy}
    >
      <ModalHeader
        title="미등원 재촉"
        description={dateLabel + " 명단에서 선택한 학생에게 재촉 알림톡을 한 번 요청합니다."}
        noIcon
      />
      <ModalBody>
        <div className="grid min-w-0 gap-4">
          {!submitted && (
            <>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-bold">수신자</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {RECIPIENTS.map(({ value, label }) => (
                    <label key={value} className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name="clinic-bulk-recipient" checked={recipient === value} onChange={() => setRecipient(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">대상 {selected.size}명 선택</strong>
                <Button size="sm" onClick={() => setSelected(selected.size
                  ? new Map()
                  : new Map(rows.filter((row) => perStudent.get(row.student) === 1).map((row) => [row.student, row.id])))}>
                  {selected.size ? "선택 해제" : hasMultiple ? "예약이 하나인 학생 선택" : "전체 선택"}
                </Button>
              </div>
              {hasMultiple && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  예약이 여러 개인 학생은 보낼 시간대 하나를 선택해 주세요.
                </p>
              )}
            </>
          )}
          {submitted && (
            <div className="grid gap-1">
              <p role="status" className="text-sm font-semibold">
                {busy ? "알림톡 요청 중…" : <>접수 {accepted}명 · 확인 필요 {retryCount + reviewCount}명 · 제외 {excluded}명</>}
              </p>
              {!busy && reviewCount > 0 && (
                <Link to="/workspace/message/log" className="text-sm font-semibold underline">발송 내역 열기</Link>
              )}
            </div>
          )}
          <ul className="grid min-w-0 gap-1" aria-label="재촉 대상">
            {(submitted ? selectedRows : rows).map((row) => {
              const outcome = outcomes.get(row.id);
              const time = row.booking_start_time && row.booking_end_time
                ? clinicBookingRangeText(row)
                : (row.preferred_start_time ?? row.session_start_time)?.slice(0, 5);
              return (
                <li key={row.id} className="rounded-md border border-[var(--color-border-divider)]">
                  <label className="flex min-h-11 items-start gap-3 px-3 py-2">
                    {!submitted && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.get(row.student) === row.id}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelected((previous) => {
                            const next = new Map(previous);
                            if (checked) next.set(row.student, row.id);
                            else next.delete(row.student);
                            return next;
                          });
                        }}
                      />
                    )}
                    <span className="grid min-w-0 gap-0.5 break-words text-sm">
                      <strong>{row.student_name}</strong>
                      <span className="text-[var(--color-text-secondary)]">
                        {[time, row.session_title, row.session_location].filter(Boolean).join(" · ")}
                      </span>
                      {submitted && <span>{outcome?.message ?? "요청 대기 중"}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </ModalBody>
      <ModalFooter right={(
        <>
          <Button onClick={onClose} disabled={busy}>{submitted ? "닫기" : "취소"}</Button>
          {(!submitted || retryCount > 0) && (
            <Button
              intent="primary"
              loading={busy}
              disabled={busy || (!submitted && !selected.size)}
              onClick={() => void send()}
            >
              {submitted ? "미접수 대상 다시 시도" : selected.size + "명에게 재촉 요청"}
            </Button>
          )}
        </>
      )} />
    </AdminModal>
  );
}
