import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { BellRing, Check, Clock3, LogIn, LogOut, X } from "lucide-react";

import styles from "./ClinicParticipantActionDialog.module.css";

export type ClinicRecipient = "student" | "parent" | "both";
export type ClinicParticipantAction = "arrive" | "late" | "checkout" | "remind" | "absent";

export type ClinicParticipantActionPayload = {
  send_to: ClinicRecipient;
  mode?: "once" | "repeat";
  interval_minutes?: number;
  repeat_until?: string;
};

type Props = {
  action: ClinicParticipantAction;
  participantName: string;
  selectedDate: string;
  withoutArrival?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: ClinicParticipantActionPayload) => void;
};

const ACTION_COPY: Record<
  ClinicParticipantAction,
  { title: string; eyebrow: string; description: string; confirm: string }
> = {
  arrive: {
    title: "등원 처리",
    eyebrow: "정상 등원",
    description: "클리닉 정보와 실제 등원 시각을 선택한 수신자에게 알립니다.",
    confirm: "등원 확정",
  },
  late: {
    title: "지각 등원 처리",
    eyebrow: "상태 교정",
    description: "결석 처리 후 도착한 학생도 지각 등원으로 바로 복구할 수 있습니다.",
    confirm: "지각 등원 확정",
  },
  checkout: {
    title: "하원 처리",
    eyebrow: "하원 기록",
    description: "하원 시각을 자율학습 완료와 별도로 기록하고 선택한 수신자에게 알립니다.",
    confirm: "하원 확정",
  },
  remind: {
    title: "등원 재촉",
    eyebrow: "미등원 안내",
    description: "지금 한 번 보내거나, 오늘 밤 10시 안에서 지정 간격으로 반복합니다.",
    confirm: "재촉 발송",
  },
  absent: {
    title: "결석 확인",
    eyebrow: "오늘 방문하지 않음",
    description: "결석으로 확정한 뒤 기존 예약을 옮기거나 새 보충 일정을 만들 수 있습니다.",
    confirm: "결석 확정",
  },
};

function defaultRecipient(action: ClinicParticipantAction): ClinicRecipient {
  if (action === "arrive") return "both";
  if (action === "remind") return "student";
  return "parent";
}

function ActionIcon({ action }: { action: ClinicParticipantAction }) {
  if (action === "arrive" || action === "late") return <LogIn size={20} aria-hidden />;
  if (action === "checkout") return <LogOut size={20} aria-hidden />;
  if (action === "remind") return <BellRing size={20} aria-hidden />;
  return <X size={20} aria-hidden />;
}

export default function ClinicParticipantActionDialog({
  action,
  participantName,
  selectedDate,
  withoutArrival = false,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const copy = action === "checkout" && withoutArrival
    ? {
        title: "하원 처리",
        eyebrow: "하원",
        description: "등원 기록은 만들지 않고 하원 시각만 남긴 뒤 선택한 수신자에게 알립니다.",
        confirm: "하원 확정",
      }
    : ACTION_COPY[action];
  const [sendTo, setSendTo] = useState<ClinicRecipient>(() => defaultRecipient(action));
  const [mode, setMode] = useState<"once" | "repeat">("once");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [repeatUntil, setRepeatUntil] = useState("22:00");

  const validationMessage = useMemo(() => {
    if (action !== "remind" || mode !== "repeat") return "";
    const interval = Number(intervalMinutes);
    if (!Number.isInteger(interval) || interval < 10) return "반복 간격은 10분 이상이어야 합니다.";
    if (!/^\d{2}:\d{2}$/.test(repeatUntil) || repeatUntil > "22:00") {
      return "반복 종료는 오늘 밤 10시를 넘길 수 없습니다.";
    }
    return "";
  }, [action, intervalMinutes, mode, repeatUntil]);

  const submit = useCallback(() => {
    if (busy || validationMessage) return;
    if (action === "remind" && mode === "repeat") {
      onConfirm({
        send_to: sendTo,
        mode,
        interval_minutes: Number(intervalMinutes),
        repeat_until: dayjs(`${selectedDate}T${repeatUntil}:00`).format(),
      });
      return;
    }
    if (action === "checkout") {
      onConfirm({ send_to: sendTo });
      return;
    }
    onConfirm(action === "remind" ? { send_to: sendTo, mode: "once" } : { send_to: sendTo });
  }, [action, busy, intervalMinutes, mode, onConfirm, repeatUntil, selectedDate, sendTo, validationMessage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, submit]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className={`${styles.dialog} ${action === "absent" ? styles.danger : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        <form onSubmit={handleSubmit}>
          <header className={styles.header}>
            <span className={styles.icon}><ActionIcon action={action} /></span>
            <div>
              <span className={styles.eyebrow}>{copy.eyebrow}</span>
              <h2>{copy.title}</h2>
              <p><strong>{participantName}</strong> · {copy.description}</p>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
              <X size={19} aria-hidden />
            </button>
          </header>

          {action === "remind" && (
            <fieldset className={styles.fieldset}>
              <legend>발송 방식</legend>
              <div className={styles.segmented}>
                <label><input type="radio" name="reminder-mode" checked={mode === "once"} onChange={() => setMode("once")} />1회 발송</label>
                <label><input type="radio" name="reminder-mode" checked={mode === "repeat"} onChange={() => setMode("repeat")} />반복 발송</label>
              </div>
              {mode === "repeat" && (
                <div className={styles.repeatGrid}>
                  <label>
                    반복 간격(분)
                    <input type="number" min={10} step={5} value={intervalMinutes} onChange={(event) => setIntervalMinutes(event.target.value)} />
                  </label>
                  <label>
                    반복 종료
                    <span className={styles.timeInput}><Clock3 size={15} aria-hidden /><input type="time" max="22:00" value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} /></span>
                  </label>
                </div>
              )}
              {validationMessage && <p className={styles.error}>{validationMessage}</p>}
            </fieldset>
          )}

          <fieldset className={styles.fieldset}>
            <legend>알림톡 수신자</legend>
            <div className={styles.recipientGrid}>
              {([
                ["student", "학생"],
                ["parent", "학부모"],
                ["both", "둘 다"],
              ] as const).map(([value, label]) => (
                <label key={value} className={sendTo === value ? styles.selected : ""}>
                  <input type="radio" name="recipient" value={value} checked={sendTo === value} onChange={() => setSendTo(value)} />
                  <span>{label}</span>
                  {sendTo === value && <Check size={15} aria-hidden />}
                </label>
              ))}
            </div>
            <p className={styles.note}>승인된 공용 알림톡 양식이 없으면 발송하지 않습니다.</p>
          </fieldset>

          <footer className={styles.footer}>
            <span><kbd>Esc</kbd> 취소 · <kbd>Enter</kbd> 확정</span>
            <div>
              <button type="button" className={styles.cancel} onClick={onClose}>취소</button>
              <button type="submit" className={styles.confirm} disabled={busy || !!validationMessage}>
                {busy ? "처리 중…" : copy.confirm}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
