/**
 * 공통 학원 로고 (2번 테넌트 제외) — SVG 인라인, 배경 없음
 * 열린 책 + 위쪽 잎. 로그인·학생 상단바에서 사용.
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
        d="M20 12v20l-9-1.2V13.2L20 12Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* 열린 책 — 오른쪽 페이지 */}
      <path
        d="M20 12v20l9-1.2V13.2L20 12Z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* 책 위 잎 (성장·교육) */}
      <ellipse cx="20" cy="9" rx="3" ry="4" fill="currentColor" opacity="0.95" />
    </svg>
  );
}
