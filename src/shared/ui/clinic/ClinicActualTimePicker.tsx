import type { RefObject } from "react";

import styles from "./ClinicActualTimePicker.module.css";

export type ClinicBookingAvailability = {
  interval_minutes: 30 | 60;
  max_stay_minutes: number;
  window: { start_time: string; end_time: string };
  slots: Array<{ start_time: string; end_time: string; remaining_capacity: number }>;
};

type Props = {
  availability?: ClinicBookingAvailability;
  loading: boolean;
  error: boolean;
  bookingStart: string;
  bookingEnd: string;
  onBookingStartChange: (value: string) => void;
  onBookingEndChange: (value: string) => void;
  onRetry: () => void;
  tone: "student" | "admin" | "teacher";
  selectionCount?: number;
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

function timeToMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function durationText(startTime: string, endTime: string): string {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) return "";
  const minutes = end === 0 && start > 0 ? 24 * 60 - start : Math.max(end - start, 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0
    ? `${hours}시간${remainder > 0 ? ` ${remainder}분` : ""}`
    : `${minutes}분`;
}

export function ClinicActualTimePicker({
  availability,
  loading,
  error,
  bookingStart,
  bookingEnd,
  onBookingStartChange,
  onBookingEndChange,
  onRetry,
  tone,
  selectionCount,
  headingRef,
}: Props) {
  const allSlots = availability?.slots ?? [];
  const availableStartSlots = allSlots.filter((slot) => slot.remaining_capacity > 0);
  const bookingStartIndex = allSlots.findIndex((slot) => slot.start_time === bookingStart);
  const intervalMinutes = availability?.interval_minutes ?? 60;
  const availableEndSlots = bookingStartIndex < 0 ? [] : allSlots.filter((_slot, index) => (
    index >= bookingStartIndex
    && (index - bookingStartIndex + 1) * intervalMinutes <= (availability?.max_stay_minutes ?? 0)
    && allSlots.slice(bookingStartIndex, index + 1)
      .every((candidate) => candidate.remaining_capacity > 0)
  ));
  const hasSlots = (availability?.slots.length ?? 0) > 0;
  const unavailable = !loading && !error && availableStartSlots.length === 0;
  const bookingEndIndex = bookingStartIndex < 0
    ? -1
    : allSlots.findIndex((slot, index) => index >= bookingStartIndex && slot.end_time === bookingEnd);
  const selectedRailStyle = bookingStartIndex >= 0 && bookingEndIndex >= bookingStartIndex
    ? {
        left: `${(bookingStartIndex / allSlots.length) * 100}%`,
        width: `${((bookingEndIndex - bookingStartIndex + 1) / allSlots.length) * 100}%`,
      }
    : undefined;
  const windowText = availability
    ? `${availability.window.start_time.slice(0, 5)}–${availability.window.end_time.slice(0, 5)}`
    : "확인 중";

  return (
    <section className={`${styles.picker} ${styles[tone]}`} aria-label="실제 예약 시간">
      <h3 ref={headingRef} tabIndex={-1} className={styles.heading}>실제 이용 시간 선택</h3>
      <div className={styles.operatingInfo}>
        <span>운영 시간</span>
        <strong>{windowText}</strong>
        <small>{loading
          ? "예약 가능한 시간을 확인하고 있어요"
          : `${availability?.interval_minutes ?? 60}분 간격 · 최대 ${availability?.max_stay_minutes ?? 240}분`}</small>
      </div>
      {loading ? (
        <div className={styles.state} role="status">
          <span className={styles.spinner} aria-hidden />
          예약 가능한 시간을 확인하고 있어요.
        </div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <strong>시간 정보를 불러오지 못했습니다.</strong>
          <span>연결을 확인한 뒤 다시 불러와 주세요.</span>
          <button type="button" onClick={onRetry}>다시 확인</button>
        </div>
      ) : unavailable ? (
        <div className={styles.state} role="status">
          <strong>{hasSlots ? "예약 가능한 시간이 모두 마감되었습니다." : "이 날짜는 예약 가능한 시간이 없습니다."}</strong>
          <span>{hasSlots ? "다른 날짜를 선택해 주세요." : "휴무일이거나 아직 예약 시간이 열리지 않았습니다."}</span>
        </div>
      ) : (
        <>
          <div
            className={styles.rail}
            role="img"
            aria-label={bookingStart && bookingEnd
              ? `운영 시간 ${availability?.window.start_time}부터 ${availability?.window.end_time}, 선택 ${bookingStart}부터 ${bookingEnd}`
              : `운영 시간 ${availability?.window.start_time}부터 ${availability?.window.end_time}`}
          >
            <div className={styles.railLabels} aria-hidden>
              <span>{availability?.window.start_time}</span>
              <strong>{bookingStart && bookingEnd ? `${bookingStart}–${bookingEnd}` : "시작·종료를 선택하세요"}</strong>
              <span>{availability?.window.end_time}</span>
            </div>
            <div className={styles.railTrack} aria-hidden>
              {selectedRailStyle && (
                <span className={styles.railSelection} data-testid="clinic-time-range-selection" style={selectedRailStyle} />
              )}
              {allSlots.map((slot) => (
                <i key={slot.start_time} className={slot.remaining_capacity > 0 ? "" : styles.railClosed} />
              ))}
            </div>
            <small aria-hidden>선택한 구간이 파란 막대로 이어져 표시됩니다.</small>
          </div>
          <fieldset className={styles.step}>
            <legend><span>1</span> 시작 시간</legend>
            <div className={styles.slotGrid}>
              {availableStartSlots.map((slot) => (
                <button
                  key={slot.start_time}
                  type="button"
                  className={bookingStart === slot.start_time ? styles.selected : ""}
                  aria-pressed={bookingStart === slot.start_time}
                  aria-label={`${slot.start_time} 시작, 잔여 ${slot.remaining_capacity}자리`}
                  onClick={() => {
                    onBookingStartChange(slot.start_time);
                    onBookingEndChange("");
                  }}
                >
                  <strong>{slot.start_time}</strong>
                  <small>잔여 {slot.remaining_capacity}자리</small>
                </button>
              ))}
            </div>
          </fieldset>
          {bookingStart && (
            <fieldset className={styles.step}>
              <legend><span>2</span> 종료 시간</legend>
              <div className={styles.slotGrid}>
                {availableEndSlots.map((slot) => {
                  const duration = durationText(bookingStart, slot.end_time);
                  return (
                    <button
                      key={slot.end_time}
                      type="button"
                      className={bookingEnd === slot.end_time ? styles.selected : ""}
                      aria-pressed={bookingEnd === slot.end_time}
                      aria-label={`${slot.end_time} 종료, 총 ${duration}`}
                      onClick={() => onBookingEndChange(slot.end_time)}
                    >
                      <strong>{slot.end_time}</strong>
                      <small>총 {duration}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </>
      )}
      {selectionCount != null && bookingStart && bookingEnd && (
        <p className={styles.commonRange} role="status">
          {selectionCount}명에게 같은 {bookingStart}–{bookingEnd} 구간을 적용합니다.
        </p>
      )}
    </section>
  );
}
