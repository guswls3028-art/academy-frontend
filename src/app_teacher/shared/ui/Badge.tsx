// PATH: src/app_teacher/shared/ui/Badge.tsx
// 공용 뱃지 — 데스크톱 ds-badge/AttendanceStatusBadge 모바일 대응
import type { CSSProperties, ReactNode } from "react";

/* ===== Tone 뱃지 ===== */

export type BadgeTone =
  | "success"
  | "danger"
  | "warning"
  | "primary"
  | "info"
  | "neutral"
  | "teal";

const TONE_COLORS: Record<BadgeTone, { color: string; bg: string }> = {
  success: { color: "var(--tc-success)", bg: "var(--tc-success-bg)" },
  danger: { color: "var(--tc-danger)", bg: "var(--tc-danger-bg)" },
  warning: { color: "#92400e", bg: "var(--tc-warn-bg)" },
  primary: { color: "var(--tc-primary)", bg: "var(--tc-primary-bg)" },
  info: { color: "var(--tc-info)", bg: "var(--tc-info-bg)" },
  neutral: { color: "var(--tc-text-muted)", bg: "var(--tc-surface-soft)" },
  teal: { color: "#0d9488", bg: "rgba(13,148,136,0.1)" },
};

export function Badge({
  children,
  tone = "neutral",
  size = "sm",
  pill = false,
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  size?: "xs" | "sm";
  pill?: boolean;
  style?: CSSProperties;
}) {
  const t = TONE_COLORS[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: size === "xs" ? 10 : 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: size === "xs" ? "2px 5px" : "3px 8px",
        borderRadius: pill ? 9999 : 4,
        color: t.color,
        background: t.bg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ===== 출석 상태 뱃지 ===== */

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ONLINE"
  | "SUPPLEMENT"
  | "EARLY_LEAVE"
  | "ABSENT"
  | "RUNAWAY"
  | "MATERIAL"
  | "INACTIVE"
  | "SECESSION";

const ATTENDANCE_CONFIG: Record<
  AttendanceStatus,
  { label: string; short: string; tone: BadgeTone }
> = {
  PRESENT: { label: "출석", short: "출", tone: "success" },
  ONLINE: { label: "영상", short: "영", tone: "primary" },
  SUPPLEMENT: { label: "보강", short: "보", tone: "teal" },
  LATE: { label: "지각", short: "지", tone: "warning" },
  EARLY_LEAVE: { label: "조퇴", short: "조", tone: "warning" },
  ABSENT: { label: "결석", short: "결", tone: "danger" },
  RUNAWAY: { label: "출튀", short: "튀", tone: "danger" },
  MATERIAL: { label: "자료", short: "자", tone: "neutral" },
  INACTIVE: { label: "부재", short: "부", tone: "neutral" },
  SECESSION: { label: "퇴원", short: "퇴", tone: "neutral" },
};

export function AttendanceBadge({
  status,
  variant = "label",
}: {
  status: string;
  variant?: "label" | "short" | "dot";
}) {
  const cfg = ATTENDANCE_CONFIG[status as AttendanceStatus] ?? {
    label: status,
    short: status?.[0] ?? "?",
    tone: "neutral" as BadgeTone,
  };

  if (variant === "dot") {
    const t = TONE_COLORS[cfg.tone];
    return (
      <span
        title={cfg.label}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: t.color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <Badge tone={cfg.tone} size={variant === "short" ? "xs" : "sm"}>
      {variant === "short" ? cfg.short : cfg.label}
    </Badge>
  );
}

/* ===== 합격/성취 뱃지 ===== */

export function AchievementBadge({
  passed,
  achievement,
}: {
  passed?: boolean | null;
  achievement?: string | null;
}) {
  if (achievement === "REMEDIATED") return <Badge tone="info">보강합격</Badge>;
  if (passed === true) return <Badge tone="success">합격</Badge>;
  if (passed === false) return <Badge tone="danger">불합격</Badge>;
  return null;
}

/* ===== 인코딩 상태 뱃지 ===== */

export function VideoStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    completed: { label: "완료", tone: "success" },
    processing: { label: "인코딩 중", tone: "warning" },
    pending: { label: "대기", tone: "neutral" },
    failed: { label: "실패", tone: "danger" },
  };
  const cfg = map[status] ?? map.pending;
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

/* ===== 클리닉 상태 뱃지 ===== */

export function ClinicStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    booked: { label: "예약", tone: "info" },
    attended: { label: "출석", tone: "success" },
    no_show: { label: "결석", tone: "danger" },
    cancelled: { label: "취소", tone: "neutral" },
    rejected: { label: "거절", tone: "neutral" },
    pending: { label: "대기", tone: "warning" },
  };
  const cfg = map[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
