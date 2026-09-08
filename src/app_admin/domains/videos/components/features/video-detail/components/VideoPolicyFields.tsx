import "./VideoPolicyFields.css";


type Props = {
  allowSkipValue: string;
  maxSpeedValue: string;
  onAllowSkipChange: (value: string) => void;
  onMaxSpeedChange: (value: string) => void;
  allowUnchanged: boolean;
  disabled?: boolean;
};

const SPEED_OPTIONS = Array.from({ length: 20 }, (_, index) => (index + 1) / 4);

export default function VideoPolicyFields({
  allowSkipValue,
  maxSpeedValue,
  onAllowSkipChange,
  onMaxSpeedChange,
  allowUnchanged,
  disabled = false,
}: Props) {
  const numericMaxSpeed = Number(maxSpeedValue);
  const hasNonStandardSpeed = (
    maxSpeedValue !== ""
    && !SPEED_OPTIONS.includes(numericMaxSpeed)
  );

  return (
    <fieldset className="video-policy-fields" disabled={disabled}>
      <legend>재생 설정</legend>
      <div className="video-policy-fields__grid">
        <label className="video-policy-fields__field">
          <span>건너뛰기 설정</span>
          <select
            aria-label="건너뛰기 설정"
            value={allowSkipValue}
            onChange={(event) => onAllowSkipChange(event.target.value)}
          >
            {allowUnchanged && <option value="">변경 안 함</option>}
            <option value="true">자유 건너뛰기 허용</option>
            <option value="false">수강 중 자유 건너뛰기 제한</option>
          </select>
        </label>

        <label className="video-policy-fields__field">
          <span>최대 배속 설정</span>
          <select
            aria-label="최대 배속 설정"
            value={maxSpeedValue}
            onChange={(event) => onMaxSpeedChange(event.target.value)}
          >
            {allowUnchanged && <option value="">변경 안 함</option>}
            {hasNonStandardSpeed && (
              <option value={maxSpeedValue}>{numericMaxSpeed.toFixed(2)}x</option>
            )}
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={String(speed)}>
                {speed.toFixed(2)}x
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="video-policy-fields__explanation">
        제한 상태에서도 수강 중에는 허용된 10초 이동을 사용할 수 있고, 복습에서는 자유롭게 이동할 수 있습니다.
      </p>
      <p className="video-policy-fields__priority">
        개별 학생 권한을 설정한 경우 학생별 설정이 우선합니다.
      </p>
    </fieldset>
  );
}
