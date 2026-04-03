// PATH: src/features/videos/components/features/video-permission/components/PermissionFilter.tsx

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/ds";

interface Props {
  filters: any;
  setFilters: (f: any) => void;
  onClose: () => void;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "h-8 px-3 rounded-full border text-xs font-semibold transition-all duration-150",
        active
          ? "bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] hover:bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))]"
      )}
    >
      {label}
    </button>
  );
}

/** 출결 상태 10개 (AttendanceStatusBadge SSOT) */
const ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "현장" },
  { value: "ONLINE", label: "영상" },
  { value: "SUPPLEMENT", label: "보강" },
  { value: "LATE", label: "지각" },
  { value: "EARLY_LEAVE", label: "조퇴" },
  { value: "ABSENT", label: "결석" },
  { value: "RUNAWAY", label: "출튀" },
  { value: "MATERIAL", label: "자료" },
  { value: "INACTIVE", label: "부재" },
  { value: "SECESSION", label: "퇴원" },
] as const;

/** 권한 */
const RULE_OPTIONS = [
  { value: "free", label: "무제한" },
  { value: "once", label: "1회" },
  { value: "blocked", label: "제한" },
] as const;

export default function PermissionFilter({
  filters,
  setFilters,
  onClose,
}: Props) {
  const [local, setLocal] = useState<any>({
    attendance_status: filters.attendance_status ?? "",
    rule: filters.rule ?? "",
    grade: filters.grade ?? "",
  });

  // Immediate apply (no confirm button)
  useEffect(() => {
    const next: any = {};
    Object.entries(local).forEach(([k, v]) => {
      if (v) next[k] = v;
    });
    setFilters(next);
  }, [local]);

  const reset = () => {
    setLocal({
      attendance_status: "",
      rule: "",
      grade: "",
    });
    setFilters({});
  };

  const activeCount = Object.values(local).filter(Boolean).length;

  return (
    <div className="permission-modal-overlay">
      <div
        className="w-full max-w-[640px]"
        style={{
          borderRadius: "var(--radius-xl)",
          background: "var(--color-bg-surface)",
          boxShadow: "var(--elevation-3), 0 0 0 1px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-semibold"
                  style={{
                    fontSize: "var(--text-sm, 13px)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  필터
                </span>
                {activeCount > 0 && (
                  <span
                    className="ds-status-badge ds-status-badge--1ch"
                    data-tone="primary"
                  >
                    {activeCount}
                  </span>
                )}
              </div>
              <div
                className="mt-1"
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-muted)",
                }}
              >
                선택 즉시 반영됩니다
              </div>
            </div>
            <Button intent="ghost" size="sm" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "0 var(--space-5) var(--space-5)" }}>
          <div
            className="space-y-5"
            style={{
              marginTop: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
              padding: "var(--space-4)",
            }}
          >
            {/* 출석 */}
            <div>
              <div
                className="font-semibold mb-2.5"
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                출석 상태
              </div>
              <div className="flex flex-wrap gap-2">
                {ATTENDANCE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={local.attendance_status === o.value}
                    onClick={() =>
                      setLocal({
                        ...local,
                        attendance_status:
                          local.attendance_status === o.value ? "" : o.value,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "var(--color-border-subtle)",
              }}
            />

            {/* 권한 */}
            <div>
              <div
                className="font-semibold mb-2.5"
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                접근 권한
              </div>
              <div className="flex gap-2">
                {RULE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={local.rule === o.value}
                    onClick={() =>
                      setLocal({
                        ...local,
                        rule: local.rule === o.value ? "" : o.value,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "var(--color-border-subtle)",
              }}
            />

            {/* 학년 */}
            <div>
              <div
                className="font-semibold mb-2.5"
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                학년
              </div>
              {[
                { label: "초", nums: ["1", "2", "3", "4", "5", "6"] },
                { label: "중", nums: ["1", "2", "3"] },
                { label: "고", nums: ["1", "2", "3"] },
              ].map((g) => (
                <div key={g.label} className="flex items-center gap-2 mb-2">
                  <span
                    className="w-6 font-semibold"
                    style={{
                      fontSize: "var(--text-xs, 11px)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {g.label}
                  </span>
                  {g.nums.map((n) => {
                    const value = `${g.label}${n}`;
                    return (
                      <Chip
                        key={value}
                        label={n}
                        active={local.grade === value}
                        onClick={() =>
                          setLocal({
                            ...local,
                            grade: local.grade === value ? "" : value,
                          })
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* RESET */}
            <div className="flex justify-end pt-1">
              <Button
                intent={activeCount > 0 ? "danger" : "ghost"}
                size="sm"
                onClick={reset}
              >
                전체 초기화{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
