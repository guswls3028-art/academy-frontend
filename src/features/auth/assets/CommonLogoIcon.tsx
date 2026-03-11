/**
 * 공통 학원 로고 (2번 테넌트 제외) — SVG 인라인, 배경 없음
 * 별 + 졸업모자(3D 입체). 로고·학생 상단바·관리자 헤더에서 사용.
 * 참고: SVG width/height attribute에는 "auto" 불가 — 숫자 또는 "100%" 등 length만 사용.
 */
type Props = {
  width?: number | string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
};

const isValidSvgLength = (v: number | string): v is number | string =>
  typeof v === "number" || (typeof v === "string" && v !== "auto");

export default function CommonLogoIcon({
  width = "auto",
  height = 32,
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: Props) {
  const svgWidth = isValidSvgLength(width) ? width : undefined;
  const svgHeight = typeof height === "number" ? height : undefined;
  const styleWithAuto = width === "auto" ? { width: "auto" as const, ...style } : style;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      {...(svgWidth != null && { width: svgWidth })}
      {...(svgHeight != null && { height: svgHeight })}
      className={className}
      style={{ display: "block", flexShrink: 0, ...styleWithAuto }}
      fill="none"
      aria-hidden={ariaHidden}
    >
      {/* 배경 원형 */}
      <circle cx="20" cy="20" r="18.5" fill="currentColor" opacity="0.07" />

      {/* 별 (5각형) — 상단 */}
      <path
        d="M20 2 L21 4.6 L23.8 4.8 L21.6 6.5 L22.4 9.2 L20 7.7 L17.6 9.2 L18.4 6.5 L16.2 4.8 L19 4.6 Z"
        fill="currentColor"
        opacity="0.92"
      />

      {/* 졸업모자 판 (마름모) */}
      <path
        d="M20 12 L33 18 L20 24 L7 18 Z"
        fill="currentColor"
        opacity="0.95"
      />

      {/* 졸업모자 3D 오른쪽 면 */}
      <path
        d="M20 24 L33 18 L33 25.5 Q33 30 20 33 Z"
        fill="currentColor"
        opacity="0.55"
      />

      {/* 졸업모자 3D 왼쪽 면 */}
      <path
        d="M20 24 L7 18 L7 25.5 Q7 30 20 33 Z"
        fill="currentColor"
        opacity="0.38"
      />

      {/* 모자 술 — 실 */}
      <path
        d="M33 18 V28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 모자 술 — 장식 */}
      <circle cx="33" cy="30.5" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
