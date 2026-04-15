/**
 * ProgressRing — SVG 원형 프로그레스 인디케이터
 * 영상 완료율, 저장소 용량 등에 사용.
 */

type ProgressRingProps = {
  /** 0-100 퍼센트 */
  percent: number;
  /** SVG 크기 (px). 기본 80 */
  size?: number;
  /** 선 두께. 기본 6 */
  strokeWidth?: number;
  /** 진행 색상. 기본 --stu-primary */
  color?: string;
  /** 중앙 라벨 (비워두면 percent% 표시) */
  label?: string;
  /** 중앙 라벨 아래 부제 */
  sublabel?: string;
};

export default function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 6,
  color = "var(--stu-primary)",
  label,
  sublabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* 배경 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--stu-surface-soft)"
          strokeWidth={strokeWidth}
        />
        {/* 진행 바 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      {/* 중앙 텍스트 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: size * 0.2,
            fontWeight: 800,
            color: "var(--stu-text)",
            lineHeight: 1.2,
          }}
        >
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: size * 0.12,
              color: "var(--stu-text-muted)",
              fontWeight: 600,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
