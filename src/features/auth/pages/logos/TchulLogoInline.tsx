// PATH: src/features/auth/pages/logos/TchulLogoInline.tsx
// 박철과학 로고 — SVG+텍스트 구현 (이미지 파일 대신, 배경 없음)
import styles from "../login/TchulLoginPage.module.css";

export default function TchulLogoInline() {
  return (
    <div className={styles.logoBlock} aria-hidden>
      <svg
        className={styles.logoIcon}
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="박철과학"
      >
        <defs>
          <linearGradient id="tchul-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d47a1" />
            <stop offset="100%" stopColor="#00695c" />
          </linearGradient>
        </defs>
        {/* Open book (simplified) */}
        <path
          d="M25 55 L25 25 Q35 20 50 22 L50 58 Q35 56 25 55 Z"
          stroke="url(#tchul-grad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M50 22 L50 58 Q65 56 75 55 L75 25 Q65 20 50 22 Z"
          stroke="url(#tchul-grad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* DNA helix (stylized) */}
        <path
          d="M35 50 Q50 35 70 45 Q85 52 85 30"
          stroke="url(#tchul-grad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M45 55 Q58 42 78 50 Q92 58 92 38"
          stroke="url(#tchul-grad)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="50" cy="38" r="3" fill="url(#tchul-grad)" />
        <circle cx="65" cy="48" r="2.5" fill="url(#tchul-grad)" opacity="0.9" />
      </svg>
      <p className={styles.logoTitle}>박철과학</p>
      <p className={styles.logoSub}>Fe Lab</p>
      <p className={styles.logoSlogan}>
        과학은 <span className={styles.logoHighlight}>철두철미하게</span>, 결과는{" "}
        <span className={styles.logoHighlight}>철용성처럼</span>.
      </p>
    </div>
  );
}
