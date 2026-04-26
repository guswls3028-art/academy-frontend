// PATH: src/app_teacher/shared/ui/Badge.tsx
//
// 선생님(모바일/PC) 뱃지 — 전역 DS Badge SSOT(ds-badge) 위에 얹은 어댑터.
//
// 시각 통일: shared/ui/ds Badge 와 동일한 사이즈/색 토큰 사용.
// 기존 API 보존: tone (success/danger/warning/primary/info/neutral/teal),
//              size (xs/sm), pill (boolean — false면 사각 둥근).
//
// 출결/합격/영상/클리닉 wrapper는 그대로 유지 (라벨/톤 매핑만).
import type { CSSProperties, ReactNode } from "react";
import { Badge as DsBadge, type BadgeTone as DsTone, type BadgeSize as DsSize } from "@/shared/ui/ds";

/* ===== Tone 뱃지 ===== */

export type BadgeTone =
  | "success"
  | "danger"
  | "warning"
  | "primary"
  | "info"
  | "neutral"
  | "teal";

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
  // teacher 기존 default size="sm" → ds Badge "sm" (11px) 동일 매핑
  // teacher "xs" → ds "xs" (10px)
  const dsSize: DsSize = size === "xs" ? "xs" : "sm";
  return (
    <DsBadge
      tone={tone as DsTone}
      size={dsSize}
      shape={pill ? "pill" : "square"}
      style={style}
    >
      {children}
    </DsBadge>
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

const TONE_DOT_COLOR: Record<BadgeTone, string> = {
  success: "var(--color-success, #22c55e)",
  danger: "var(--color-error, #ef4444)",
  warning: "var(--color-warning, #f59e0b)",
  primary: "var(--color-brand-primary, #3b82f6)",
  info: "var(--color-info, #06b6d4)",
  neutral: "var(--color-text-muted, #6b7280)",
  teal: "#14b8a6",
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
    return (
      <span
        title={cfg.label}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: TONE_DOT_COLOR[cfg.tone],
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
  // SSOT: achievement(PASS/REMEDIATED/FAIL) 우선, passed boolean fallback.
  // 일부 응답이 achievement만 주거나 passed만 주는 경우 모두 대응.
  if (achievement === "REMEDIATED") return <Badge tone="info">보강합격</Badge>;
  if (achievement === "PASS" || passed === true) return <Badge tone="success">합격</Badge>;
  if (achievement === "FAIL" || passed === false) return <Badge tone="danger">불합격</Badge>;
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
