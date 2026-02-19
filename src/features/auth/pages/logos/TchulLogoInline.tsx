// PATH: src/features/auth/pages/logos/TchulLogoInline.tsx
// 박철과학 로고 — 원본과 동일하게 SVG+텍스트 구현 (배경 없음)
import styles from "../login/TchulLoginPage.module.css";

export default function TchulLogoInline() {
  return (
    <div className={styles.logoBlock} aria-hidden>
      <svg
        className={styles.logoIcon}
        viewBox="0 0 160 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="박철과학"
      >
        <defs>
          <linearGradient id="tchul-icon-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2a7fb4" />
            <stop offset="50%" stopColor="#36a798" />
            <stop offset="100%" stopColor="#65c36a" />
          </linearGradient>
        </defs>
        {/* Open book — 왼쪽 페이지 */}
        <path
          d="M 28 68 L 28 32 L 52 28 L 52 72 L 28 68 Z"
          stroke="url(#tchul-icon-grad)"
          strokeWidth="3.5"
          fill="none"
          strokeLinejoin="round"
        />
        {/* Open book — 오른쪽 페이지 */}
        <path
          d="M 52 28 L 52 72 L 132 68 L 132 32 L 52 28 Z"
          stroke="url(#tchul-icon-grad)"
          strokeWidth="3.5"
          fill="none"
          strokeLinejoin="round"
        />
        {/* DNA 이중나선 — 왼쪽 가닥 */}
        <path
          d="M 42 72 Q 48 58 52 50 Q 56 42 62 35 Q 70 28 80 26 Q 95 22 108 28 Q 118 34 122 42"
          stroke="url(#tchul-icon-grad)"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* DNA 이중나선 — 오른쪽 가닥 */}
        <path
          d="M 48 68 Q 54 54 58 46 Q 64 38 72 32 Q 82 26 95 24 Q 108 24 118 32 Q 126 38 128 48"
          stroke="url(#tchul-icon-grad)"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* DNA 가로 막대(rungs) */}
        {[
          [44, 66, 52, 64],
          [50, 54, 58, 52],
          [54, 44, 62, 42],
          [62, 34, 72, 32],
          [78, 28, 92, 26],
          [100, 26, 112, 30],
          [116, 36, 122, 42],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#tchul-icon-grad)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <p className={styles.logoTitle}>박철 과학</p>
      <p className={styles.logoSub}>Fe Lab</p>
      <p className={styles.logoSlogan}>
        과학은 <span className={styles.logoHighlight}>철두철미하게</span>, 결과는{" "}
        <span className={styles.logoHighlight}>철웅성처럼</span>.
      </p>
    </div>
  );
}
