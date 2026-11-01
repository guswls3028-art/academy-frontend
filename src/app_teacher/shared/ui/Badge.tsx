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
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import { ATTENDANCE_META, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";
import { VIDEO_STATUS_LABEL, VIDEO_STATUS_TONE, type VideoStatus } from "@/shared/api/contracts/videos";

/* ===== Tone 뱃지 ===== */

export type BadgeTone = DsTone;

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

export type { AttendanceStatus };

const TONE_DOT_COLOR: Record<BadgeTone, string> = {
  success: "var(--color-success, #22c55e)",
  danger: "var(--color-error, #ef4444)",
  warning: "var(--color-warning, #f59e0b)",
  primary: "var(--color-brand-primary, #3b82f6)",
  info: "var(--color-info, #06b6d4)",
  neutral: "var(--color-text-muted, #6b7280)",
  muted: "var(--color-text-muted, #6b7280)",
  complement: "var(--color-brand-complement)",
  teal: "#14b8a6",
};

export function AttendanceBadge({
  status,
  variant = "label",
}: {
  status: string;
  variant?: "label" | "short" | "dot";
}) {
  const cfg = ATTENDANCE_META[status as AttendanceStatus] ?? {
    label: status,
    short: status?.[0] ?? "?",
    tone: "neutral" as BadgeTone,
  };

  if (variant === "dot") {
    return (
      <span
        title={cfg.label}
        // eslint-disable-next-line no-restricted-syntax
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
  // SSOT: achievement(PASS/REMEDIATED/FAIL/NOT_SUBMITTED) 우선,
  // achievement가 없을 때만 passed boolean fallback.
  // 일부 응답이 achievement만 주거나 passed만 주는 경우 모두 대응.
  // 2026-05-13: Tenant.pass_label/fail_label 학원장 커스텀 라벨 반영.
  const labels = useTenantLabels();
  if (achievement === "NOT_SUBMITTED") return <Badge tone="neutral">미응시</Badge>;
  if (achievement === "REMEDIATED") return <Badge tone="info">{`보강 ${labels.pass}`}</Badge>;
  if (achievement === "PASS" || (achievement == null && passed === true)) return <Badge tone="success">{labels.pass}</Badge>;
  if (achievement === "FAIL" || (achievement == null && passed === false)) return <Badge tone="danger">{labels.fail}</Badge>;
  return null;
}

/* ===== 인코딩 상태 뱃지 ===== */

export function VideoStatusBadge({ status }: { status: string }) {
  const key = (status.toLowerCase() === "completed" ? "READY" : status.toUpperCase()) as VideoStatus;
  return <Badge tone={VIDEO_STATUS_TONE[key] ?? "neutral"}>{VIDEO_STATUS_LABEL[key] ?? status}</Badge>;
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
