/**
 * 공통 학원 로고 (2번 테넌트 제외) — SVG 인라인, 배경 없음
 * 로그인·학생 상단바에서 사용
 */
type Props = {
  width?: number | string;
  height?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

export default function CommonLogoIcon({
  width = "auto",
  height = 32,
  className,
  "aria-hidden": ariaHidden = true,
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={width}
      height={height}
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* 열린 책 왼쪽 페이지 */}
      <path
        d="M8 28V12c0-1.5 1.2-2.8 2.8-3L20 8v24l-9.2-1c-1.6-.2-2.8-1.5-2.8-3Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* 열린 책 오른쪽 페이지 */}
      <path
        d="M20 8c5 0 9.2.9 9.2 2v16c0 1.1-4.2 2-9.2 2V8Z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* 책 중앙 접힌 부분 + 위로 뻗는 줄기 */}
      <path
        d="M20 8v24l-9.2-1c-1.6-.2-2.8-1.5-2.8-3V12c0-1.5 1.2-2.8 2.8-3L20 8Z"
        fill="currentColor"
        opacity="0.5"
      />
      {/* 식물 잎 (책 위) */}
      <path
        d="M20 6c-1.5 0-2.5.8-2.5 2.2 0 1 .5 1.8 1.2 2.3l-.4 2.8c-.1.6.3 1.1.9 1.2.6.1 1.1-.3 1.2-.9l-.4-2.8c.7-.5 1.2-1.3 1.2-2.3C22.5 6.8 21.5 6 20 6Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M18.5 10.8c.3-.4.8-.5 1.2-.2.4.3.5.8.2 1.2l-2 2.6c-.3.4-.8.5-1.2.2-.4-.3-.5-.8-.2-1.2l2-2.6Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M21.5 10.8c-.3-.4-.8-.5-1.2-.2-.4.3-.5.8-.2 1.2l2 2.6c.3.4.8.5 1.2.2.4-.3.5-.8.2-1.2l-2-2.6Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
