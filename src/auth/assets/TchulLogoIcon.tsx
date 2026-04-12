/**
 * tchul.com(박철과학) 전용 로고 — SVG, 브랜드 그라데이션(블루→청록→그린)
 * TchulLogoTransparent.png / TchulLogoIcon.png 대체용.
 */
type Props = {
  width?: number | string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
};

export default function TchulLogoIcon({
  width,
  height = 32,
  className,
  style,
  "aria-hidden": ariaHidden = true,
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={width ?? (typeof height === "number" ? (height * 40) / 40 : undefined)}
      height={height}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      fill="none"
      aria-hidden={ariaHidden}
    >
      <defs>
        <linearGradient id="tchul-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d47a1" />
          <stop offset="50%" stopColor="#00695c" />
          <stop offset="100%" stopColor="#004d40" />
        </linearGradient>
      </defs>
      {/* 배경 원형 */}
      <circle cx="20" cy="20" r="18.5" fill="url(#tchul-logo-gradient)" opacity="0.15" />
      {/* 별 (5각형) — 상단 */}
      <path
        d="M20 2 L21 4.6 L23.8 4.8 L21.6 6.5 L22.4 9.2 L20 7.7 L17.6 9.2 L18.4 6.5 L16.2 4.8 L19 4.6 Z"
        fill="url(#tchul-logo-gradient)"
        opacity="0.95"
      />
      {/* 졸업모자 판 */}
      <path
        d="M20 12 L33 18 L20 24 L7 18 Z"
        fill="url(#tchul-logo-gradient)"
        opacity="0.95"
      />
      {/* 졸업모자 3D 오른쪽 면 */}
      <path
        d="M20 24 L33 18 L33 25.5 Q33 30 20 33 Z"
        fill="url(#tchul-logo-gradient)"
        opacity="0.6"
      />
      {/* 졸업모자 3D 왼쪽 면 */}
      <path
        d="M20 24 L7 18 L7 25.5 Q7 30 20 33 Z"
        fill="url(#tchul-logo-gradient)"
        opacity="0.45"
      />
      {/* 모자 술 */}
      <path d="M33 18 V28" stroke="url(#tchul-logo-gradient)" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <circle cx="33" cy="30.5" r="2" fill="url(#tchul-logo-gradient)" opacity="0.9" />
    </svg>
  );
}
