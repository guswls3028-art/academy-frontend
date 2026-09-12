import styles from "./ClinicBookingModeChoice.module.css";

export type ClinicBookingMode = "fixed_slot" | "time_range";

type ChoiceProps = {
  recommendedMode?: ClinicBookingMode;
  onSelect: (mode: ClinicBookingMode) => void;
};

const OPTIONS: Array<{
  mode: ClinicBookingMode;
  eyebrow: string;
  title: string;
  description: string;
  example: string;
}> = [
  {
    mode: "fixed_slot",
    eyebrow: "한 타임 예약",
    title: "시간지정 클리닉",
    description: "학생은 정해진 한 타임을 그대로 예약해요.",
    example: "17:00–18:00",
  },
  {
    mode: "time_range",
    eyebrow: "등원·하원 선택",
    title: "자유지정 클리닉",
    description: "운영 시간 안에서 학생이 실제 등원·하원 시간을 선택해요.",
    example: "15:00 운영  ·  16:00–19:00 선택  ·  22:00 종료",
  },
];

export function ClinicBookingModeChoice({ recommendedMode, onSelect }: ChoiceProps) {
  return (
    <section
      className={styles.choice}
      data-clinic-mode-choice
      aria-labelledby="clinic-booking-mode-title"
    >
      <div className={styles.heading}>
        <span>먼저 선택</span>
        <h3 id="clinic-booking-mode-title">학생이 시간을 고르는 방식을 정해주세요</h3>
        <p>선택 후 날짜·운영 시간·정원을 입력합니다.</p>
      </div>
      <div className={styles.cards} role="group" aria-label="클리닉 예약 방식">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={styles.card}
            onClick={() => onSelect(option.mode)}
          >
            <span className={styles.cardTopline}>
              <span className={styles.eyebrow}>{option.eyebrow}</span>
              {recommendedMode === option.mode && <span className={styles.recommended}>학원 기본</span>}
            </span>
            <strong>{option.title}</strong>
            <span className={styles.example} aria-hidden="true">
              {option.mode === "fixed_slot" ? (
                <><i /><b>{option.example}</b><i /></>
              ) : (
                <>
                  <small>15시</small>
                  <span className={styles.rangeTrack}><i /></span>
                  <small>22시</small>
                </>
              )}
            </span>
            {option.mode === "time_range" && <span className={styles.rangeCaption}>예: 16:00–19:00 선택</span>}
            <span className={styles.description}>{option.description}</span>
            <span className={styles.action}>이 방식으로 만들기 <span aria-hidden>→</span></span>
          </button>
        ))}
      </div>
      <p className={styles.note}>두 방식 모두 정원과 장소를 설정할 수 있고, 만든 뒤 학생 화면에 바로 반영됩니다.</p>
    </section>
  );
}

export function ClinicBookingModeSummary({
  mode,
  onChange,
}: {
  mode: ClinicBookingMode;
  onChange?: () => void;
}) {
  const title = mode === "time_range" ? "자유지정 클리닉" : "시간지정 클리닉";
  const description = mode === "time_range"
    ? "학생이 운영 시간 안에서 실제 등원·하원 시간을 선택합니다."
    : "학생이 선생님이 정한 한 타임을 그대로 예약합니다.";
  return (
    <div className={styles.summary}>
      <span>
        <small>선택한 방식 · {title}</small>
        <strong>{description}</strong>
      </span>
      {onChange && <button type="button" onClick={onChange}>방식 다시 선택</button>}
    </div>
  );
}
