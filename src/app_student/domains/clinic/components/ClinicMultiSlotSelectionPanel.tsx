import { hhmmText as formatTime } from "@/shared/ui/time/timeFormat";

import type { ClinicAvailability, ClinicSession } from "../api/clinicBooking.api";
import styles from "../pages/ClinicPage.module.css";

type Props = {
  selectedSessions: ClinicSession[];
  selectedSession: ClinicSession | null;
  memo: string;
  preferredStart: string;
  preferredEnd: string;
  bookingStart: string;
  bookingEnd: string;
  availability?: ClinicAvailability;
  availabilityPending: boolean;
  availabilityError: boolean;
  pending: boolean;
  changingBooking: boolean;
  hasError: boolean;
  onMemoChange: (value: string) => void;
  onPreferredStartChange: (value: string) => void;
  onPreferredEndChange: (value: string) => void;
  onBookingStartChange: (value: string) => void;
  onBookingEndChange: (value: string) => void;
  onAvailabilityRetry: () => void;
  onSubmit: () => void;
};

function timeToMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function selectedTimeSummary(selectedSessions: Pick<ClinicSession, "start_time" | "end_time">[]): {
  range: string;
  duration: string;
} {
  const ranges = selectedSessions.map((session) => ({
    start: formatTime(session.start_time),
    end: formatTime(session.end_time ?? session.start_time),
  }));
  const contiguous = ranges.every((range, index) => (
    index === 0 || ranges[index - 1].end === range.start
  ));
  const range = contiguous
    ? `${ranges[0].start}–${ranges[ranges.length - 1].end}`
    : ranges.map((item) => `${item.start}–${item.end}`).join(", ");
  const totalMinutes = selectedSessions.reduce((total, session) => {
    const start = timeToMinutes(session.start_time);
    const end = timeToMinutes(session.end_time);
    return start == null || end == null ? total : total + Math.max(end - start, 0);
  }, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    range,
    duration: hours > 0
      ? `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""}`
      : `${minutes}분`,
  };
}

function timeRangeDuration(startTime: string, endTime: string): string {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) return "";
  const minutes = Math.max(end - start, 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0
    ? `${hours}시간${remainder > 0 ? ` ${remainder}분` : ""}`
    : `${minutes}분`;
}

export default function ClinicMultiSlotSelectionPanel({
  selectedSessions,
  selectedSession,
  memo,
  preferredStart,
  preferredEnd,
  bookingStart,
  bookingEnd,
  availability,
  availabilityPending,
  availabilityError,
  pending,
  changingBooking,
  hasError,
  onMemoChange,
  onPreferredStartChange,
  onPreferredEndChange,
  onBookingStartChange,
  onBookingEndChange,
  onAvailabilityRetry,
  onSubmit,
}: Props) {
  const isTimeRange = selectedSessions.length === 1 && selectedSession?.booking_mode === "time_range";
  const sessionSummary = selectedTimeSummary(selectedSessions);
  const timeSummary = isTimeRange
    ? bookingStart && bookingEnd
      ? selectedTimeSummary([{ start_time: bookingStart, end_time: bookingEnd }])
      : null
    : sessionSummary;
  const availableStartSlots = availability?.slots.filter((slot) => slot.remaining_capacity > 0) ?? [];
  const bookingStartMinutes = timeToMinutes(bookingStart);
  const availableEndSlots = availability?.slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);
    if (bookingStartMinutes == null || slotStart == null || slotEnd == null || slotStart < bookingStartMinutes) return false;
    if (slotEnd - bookingStartMinutes > (availability?.max_stay_minutes ?? 0)) return false;
    return (availability?.slots ?? [])
      .filter((candidate) => {
        const candidateStart = timeToMinutes(candidate.start_time);
        return candidateStart != null && candidateStart >= bookingStartMinutes && candidateStart < slotEnd;
      })
      .every((candidate) => candidate.remaining_capacity > 0);
  }) ?? [];
  const hasAvailabilitySlots = (availability?.slots.length ?? 0) > 0;
  const timeRangeUnavailable = !availabilityPending
    && !availabilityError
    && availableStartSlots.length === 0;
  return (
    <section className={styles.selectionPanel} aria-label="선택한 클리닉 시간">
      <div className={styles.selectionSummary}>
        <span>{isTimeRange ? "예약 시간 선택" : "선택한 이용 시간"}</span>
        <strong>{timeSummary?.range ?? (bookingStart
          ? "종료 시간을 골라 주세요"
          : "예약할 시작 시간을 골라 주세요")}</strong>
        <small>{isTimeRange
          ? timeSummary ? `총 ${timeSummary.duration}` : `운영 시간 ${sessionSummary.range}`
          : `${selectedSessions.length}개 시간대 · 총 ${sessionSummary.duration}`}</small>
      </div>
      {!isTimeRange && <div className={styles.selectionSlots} aria-label="선택한 시간대 목록">
        {selectedSessions.map((session) => (
          <span key={session.id}>
            {formatTime(session.start_time)}–{formatTime(session.end_time ?? session.start_time)}
          </span>
        ))}
      </div>}
      {isTimeRange && (
        <div className={styles.timePicker}>
          <div className={styles.operatingInfo}>
            <span>운영 안내</span>
            <strong>{sessionSummary.range}</strong>
            <small>{availabilityPending
              ? "예약 가능한 시간을 확인하고 있어요"
              : `${availability?.interval_minutes ?? 60}분 간격 · 최대 ${availability?.max_stay_minutes ?? selectedSession.booking_max_stay_minutes ?? 240}분`}</small>
          </div>
          {availabilityPending ? (
            <div className={styles.availabilityState} role="status">
              <span className={styles.availabilitySpinner} aria-hidden />
              예약 가능한 시간을 확인하고 있어요.
            </div>
          ) : availabilityError ? (
            <div className={styles.availabilityState} role="alert">
              <strong>시간 정보를 불러오지 못했습니다.</strong>
              <span>네트워크 연결을 확인한 뒤 다시 불러와 주세요.</span>
              <button type="button" onClick={onAvailabilityRetry}>다시 확인</button>
            </div>
          ) : timeRangeUnavailable ? (
            <div className={styles.availabilityState} role="status">
              <strong>{hasAvailabilitySlots ? "예약 가능한 시간이 모두 마감되었습니다." : "이 날짜는 예약 가능한 시간이 없습니다."}</strong>
              <span>{hasAvailabilitySlots ? "다른 날짜를 선택해 주세요." : "휴무일이거나 아직 예약 시간이 열리지 않았습니다."}</span>
            </div>
          ) : (
            <>
              <fieldset className={styles.timeStep}>
                <legend><span>1</span> 시작 시간</legend>
                <div className={styles.timeSlotGrid}>
                  {availableStartSlots.map((slot) => (
                    <button
                      key={slot.start_time}
                      type="button"
                      className={bookingStart === slot.start_time ? styles.timeSlotSelected : ""}
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
                <fieldset className={styles.timeStep}>
                  <legend><span>2</span> 종료 시간</legend>
                  <div className={styles.timeSlotGrid}>
                    {availableEndSlots.map((slot) => {
                      const duration = timeRangeDuration(bookingStart, slot.end_time);
                      return (
                        <button
                          key={slot.end_time}
                          type="button"
                          className={bookingEnd === slot.end_time ? styles.timeSlotSelected : ""}
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
        </div>
      )}
      {!isTimeRange && selectedSessions.length === 1 && selectedSession?.allow_time_preference && (
        <fieldset className={styles.preferenceFieldset}>
          <legend>희망 이용 시간 <small>(선택)</small></legend>
          <p>운영 시간 안에서 원하는 구간을 남겨 주세요. 학원 확인 후 최종 배정됩니다.</p>
          <div className={styles.preferenceInputs}>
            <label>
              <span>시작</span>
              <input
                type="time"
                aria-label="희망 시작 시간"
                min={selectedSession.start_time.slice(0, 5)}
                max={selectedSession.end_time?.slice(0, 5)}
                step={300}
                value={preferredStart}
                onChange={(event) => onPreferredStartChange(event.target.value)}
              />
            </label>
            <span aria-hidden>–</span>
            <label>
              <span>종료</span>
              <input
                type="time"
                aria-label="희망 종료 시간"
                min={selectedSession.start_time.slice(0, 5)}
                max={selectedSession.end_time?.slice(0, 5)}
                step={300}
                value={preferredEnd}
                onChange={(event) => onPreferredEndChange(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      )}
      <label className={styles.memoField}>
        <span>학원에 전할 내용 <small>(선택)</small></span>
        <textarea
          aria-label="학원에 전할 내용 (선택)"
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
          placeholder="준비물이나 전달할 내용이 있으면 적어 주세요."
          className="stu-textarea"
          rows={2}
        />
      </label>
      <button
        type="button"
        className={`stu-btn stu-btn--primary ${styles.selectionSubmit}`}
        disabled={pending || (isTimeRange && (
          !bookingStart || !bookingEnd || availabilityPending || availabilityError
        ))}
        onClick={onSubmit}
      >
        {pending
          ? "처리 중…"
          : changingBooking
            ? "이 일정으로 변경하기"
            : selectedSessions.length > 1
              ? `${selectedSessions.length}개 시간대 예약하기`
              : "이 일정 예약하기"}
      </button>
      {hasError && (
        <p className={styles.errorText}>
          {changingBooking
            ? "일정 변경에 실패했습니다. 기존 예약은 유지됩니다."
            : "예약 신청에 실패했습니다."} 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
}
