/**
 * ProgressRing - SVG 원형 프로그레스 인디케이터
 * 영상 완료율, 저장소 용량 등에 사용.
 */
import styles from "./ProgressRing.module.css";

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
    <div className={styles.root}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* 배경 트랙 */}
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {/* 진행 바 */}
        <circle
          className={styles.progress}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {/* 중앙 텍스트 */}
      <div className={styles.center}>
        <span className={styles.label}>
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel && (
          <span className={styles.sublabel}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
