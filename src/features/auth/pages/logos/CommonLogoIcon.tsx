/**
 * 공통 학원 로고 (2번 테넌트 제외) — SVG 인라인, 배경 없음
 * 졸업모자 + 열린 책. 로그인·학생 상단바에서 사용.
 */
type Props = {
  width?: number | string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
};

export default function CommonLogoIcon({
  width = "auto",
  height = 32,
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={width}
      height={height}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      fill="none"
      aria-hidden={ariaHidden}
    >
      {/* 열린 책 — 왼쪽 페이지 */}
      <path
        d="M20 14v18l-9.5-1.2V15.2L20 14Z"
        fill="currentColor"
        opacity="0.88"
      />
      {/* 열린 책 — 오른쪽 페이지 */}
      <path
        d="M20 14v18l9.5-1.2V15.2L20 14Z"
        fill="currentColor"
        opacity="0.72"
      />
      {/* 졸업모자 판 (마름모) */}
      <path
        d="M20 12 10 16.5v1.2l10-4.2 10 4.2v-1.2L20 12Z"
        fill="currentColor"
        opacity="0.98"
      />
      {/* 모자 술 (실 + 장식) */}
      <path
        d="M20 12 21 8.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="21" cy="8" r="1.4" fill="currentColor" opacity="0.98" />
    </svg>
  );
}
