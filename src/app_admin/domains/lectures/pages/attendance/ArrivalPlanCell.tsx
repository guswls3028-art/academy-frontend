import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Clock3, X } from "lucide-react";

import { Button } from "@/shared/ui/ds";
import { useFloatingPosition } from "@/shared/ui/floating/useFloatingPosition";
import styles from "./ArrivalPlanCell.module.css";

export type ArrivalPlanPayload = {
  planned_arrival_date: string | null;
  planned_arrival_time: string | null;
  memo: string;
};

type ArrivalPlanCellProps = {
  studentName: string;
  plannedDate?: string | null;
  plannedTime?: string | null;
  memo?: string | null;
  defaultDate?: string | null;
  onSave: (payload: ArrivalPlanPayload) => Promise<void>;
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function plannedDateText(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const weekday = WEEKDAY[new Date(year, month - 1, day).getDay()];
  return `${month}/${day}(${weekday})`;
}

export default function ArrivalPlanCell({
  studentName,
  plannedDate,
  plannedTime,
  memo,
  defaultDate,
  onSave,
}: ArrivalPlanCellProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(plannedDate ?? "");
  const [time, setTime] = useState(plannedTime?.slice(0, 5) ?? "");
  const [note, setNote] = useState(memo ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const position = useFloatingPosition(triggerRef, popoverRef, open, {
    placement: "bottom",
    gap: 6,
    margin: 10,
    estimateHeight: 330,
    estimateWidth: 340,
    alignRight: false,
  });

  useEffect(() => {
    if (!open) return;
    setDate(plannedDate ?? defaultDate ?? "");
    setTime(plannedTime?.slice(0, 5) ?? "");
    setNote(memo ?? "");
    setError("");
  }, [open, plannedDate, plannedTime, memo, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const hasPlan = Boolean(plannedDate || plannedTime || memo?.trim());
  const displayTime = plannedTime?.slice(0, 5);

  const save = async () => {
    if (time && !date) {
      setError("시간을 입력하려면 날짜도 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        planned_arrival_date: date || null,
        planned_arrival_time: time || null,
        memo: note.trim(),
      });
      setOpen(false);
      triggerRef.current?.focus();
    } catch {
      setError("저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.cellButton}
        data-empty={hasPlan ? "false" : "true"}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${studentName} 등원 예정 ${hasPlan ? "수정" : "입력"}`}
      >
        {hasPlan ? (
          <>
            <span className={styles.planLine}>
              <CalendarClock size={14} aria-hidden />
              {plannedDate ? plannedDateText(plannedDate) : "날짜 미정"}
              <strong>{displayTime || "시간 미정"}</strong>
            </span>
            {memo?.trim() ? <span className={styles.memoLine}>{memo.trim()}</span> : null}
          </>
        ) : (
          <span className={styles.emptyLine}>
            <Clock3 size={14} aria-hidden />
            예정 입력
          </span>
        )}
      </button>

      {open && position && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-label={`${studentName} 등원 예정 편집`}
          className={styles.popover}
          // eslint-disable-next-line no-restricted-syntax -- viewport-clamped floating coordinates are calculated at runtime
          style={{ top: position.top, left: position.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <header className={styles.header}>
            <div>
              <span>보강 등원 예정</span>
              <strong>{studentName}</strong>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="등원 예정 편집 닫기"
            >
              <X size={17} aria-hidden />
            </button>
          </header>

          <div className={styles.fields}>
            <label>
              <span>예정 날짜</span>
              <input
                type="date"
                className="ds-input"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              <span>예정 시간</span>
              <input
                type="time"
                className="ds-input"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={saving || !date}
              />
            </label>
          </div>

          <label className={styles.noteField}>
            <span>준비 메모</span>
            <textarea
              className="ds-input"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="예: 2차시 시험지 준비"
              disabled={saving}
            />
          </label>

          {error ? <p className={styles.error} role="alert">{error}</p> : null}

          <footer className={styles.actions}>
            <Button
              intent="secondary"
              size="sm"
              onClick={() => {
                setDate("");
                setTime("");
                setNote("");
                setError("");
              }}
              disabled={saving || (!date && !time && !note)}
            >
              입력 지우기
            </Button>
            <Button intent="primary" size="sm" onClick={save} disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </footer>
        </div>,
        document.body,
      )}
    </>
  );
}
