import { useEffect, useRef, type ReactNode } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import { DatePicker } from "@/shared/ui/date";
import { Button } from "@/shared/ui/ds";
import styles from "./InitialSessionDays.module.css";

export type NewSessionDay = { key: string; label: string; date: string };

const MAX_DAYS = 20;

type Props = {
  days: NewSessionDay[];
  names: string[];
  disabled: boolean;
  onChange: (key: string, value: Partial<Pick<NewSessionDay, "label" | "date">>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  children: ReactNode;
};

export default function InitialSessionDays({ days, names, disabled, onChange, onRemove, onAdd, children }: Props) {
  const focusLast = useRef(false);
  const lastInput = useRef<HTMLInputElement>(null);
  const multiple = days.length > 1;

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    lastInput.current?.focus();
  }, [days.length]);

  return (
    <section className={styles.days} aria-label="차시 수업일">
      {!multiple && children}
      {multiple && <div className={styles.rows}>
        {days.map((day, index) => (
          <div className={styles.row} key={day.key}>
            <div className={styles.rowTitle}>
              <span><CalendarDays size={15} aria-hidden />{index === 0 ? "기본 수업일" : `수업일 ${index + 1}`}</span>
              {index > 0 && <Button intent="ghost" size="sm" leftIcon={<X size={14} aria-hidden />} onClick={() => onRemove(day.key)} aria-label={`수업일 ${index + 1} 제거`} disabled={disabled}>제거</Button>}
            </div>
            {index === 0 && children}
            <div className={index === 0 ? undefined : styles.fields}>
              <label className={styles.dayName}>
                반 이름
                <input className="ds-input" aria-label={`수업일 ${index + 1} 이름`} ref={index === days.length - 1 ? lastInput : undefined} value={day.label} placeholder={names[index]} maxLength={40} onChange={event => onChange(day.key, { label: event.target.value })} disabled={disabled} />
              </label>
              {index > 0 ? (
                <div>
                  <label htmlFor={`initial-day-${day.key}`}><span className="sr-only">수업일 {index + 1} </span>날짜</label>
                  <DatePicker id={`initial-day-${day.key}`} value={day.date} onChange={date => onChange(day.key, { date })} disabled={disabled} />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>}
      {days.length < MAX_DAYS ? (
        <Button className={styles.add} intent="secondary" size="sm" leftIcon={<Plus size={16} aria-hidden />} onClick={() => { focusLast.current = true; onAdd(); }} disabled={disabled}>수업일 추가</Button>
      ) : <p className={styles.limit}>차시당 최대 {MAX_DAYS}개의 수업일을 추가할 수 있습니다.</p>}
    </section>
  );
}
