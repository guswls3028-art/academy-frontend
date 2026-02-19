/**
 * 학생 앱 전역 아이콘 — 단일 SSOT, 아이콘 방식
 * tchul/9999 테넌트에서 .stu-icon 그라데이션은 tenants/tchul.css에서 적용
 */
import type { SVGProps } from "react";

const size = 24;
const stroke = 2;

const iconProps = { className: "stu-icon" } as const;

function mergeIconProps(props: SVGProps<SVGSVGElement>) {
  return { ...iconProps, ...props, className: [iconProps.className, props.className].filter(Boolean).join(" ") };
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <polygon points="8 5 19 12 8 19" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" fill="currentColor" />
    </svg>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path d="M8 3v4M16 3v4M3 9h18" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function IconGrade(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M12 2l3 6.5 6.5.5-5 4.5 1.5 6.5L12 16l-5.5 4 1.5-6.5-5-4.5 6.5-.5L12 2z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
    </svg>
  );
}

export function IconMore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth={stroke} />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function IconBoard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconExam(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M9 12h6M9 16h6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconNotice(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m-6 0H9" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...mergeIconProps(props)}>
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconVideoThumb({ className }: { className?: string }) {
  return (
    <svg className={className} width="100%" viewBox="0 0 16 9" fill="none">
      <rect width="16" height="9" fill="var(--stu-surface-soft)" />
      <path d="M6 4.5v-2l3 2-3 2v-2z" fill="var(--stu-text-muted)" />
    </svg>
  );
}
