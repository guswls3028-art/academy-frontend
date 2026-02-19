// PATH: src/features/auth/pages/logos/TchulLogoIcon.tsx
// 박철과학 아이콘 — 1:1 비율, 텍스트 제외, 아이콘만
import React from "react";

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function TchulLogoIcon({ size = 36, className, style }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="박철과학"
      style={style}
    >
      <defs>
        <linearGradient id="tchul-icon-grad-square" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0d47a1" />
          <stop offset="50%" stopColor="#00695c" />
          <stop offset="100%" stopColor="#004d40" />
        </linearGradient>
      </defs>
      {/* Open book — 왼쪽 페이지 (중앙 정렬) */}
      <path
        d="M 30 70 L 30 30 L 50 28 L 50 72 L 30 70 Z"
        stroke="url(#tchul-icon-grad-square)"
        strokeWidth="3.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Open book — 오른쪽 페이지 */}
      <path
        d="M 50 28 L 50 72 L 70 70 L 70 30 L 50 28 Z"
        stroke="url(#tchul-icon-grad-square)"
        strokeWidth="3.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* DNA 이중나선 — 왼쪽 가닥 */}
      <path
        d="M 40 72 Q 46 58 52 50 Q 56 42 60 36 Q 66 30 74 28 Q 82 26 90 30 Q 98 36 102 44"
        stroke="url(#tchul-icon-grad-square)"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* DNA 이중나선 — 오른쪽 가닥 */}
      <path
        d="M 46 68 Q 52 54 56 46 Q 62 38 68 32 Q 76 28 86 28 Q 94 30 100 36 Q 106 42 108 50"
        stroke="url(#tchul-icon-grad-square)"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* DNA 가로 막대(rungs) */}
      {[
        [42, 70, 50, 68],
        [50, 56, 56, 54],
        [54, 44, 60, 42],
        [60, 34, 68, 32],
        [74, 28, 84, 28],
        [90, 30, 98, 36],
        [102, 42, 106, 48],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="url(#tchul-icon-grad-square)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
