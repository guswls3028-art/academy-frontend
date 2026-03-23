// PATH: src/features/videos/components/features/video-permission/components/PermissionSidePanel.tsx

import { FiX } from "react-icons/fi";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";
import { ACCESS_MODE_LABELS, RULE_LABELS, getAccessLabel, getAccessTone } from "../permission.constants";

type ApplyTone = "primary" | "warning" | "danger";

const APPLY_ACTIONS: { mode: string; label: string; tone: ApplyTone }[] = [
  { mode: "FREE_REVIEW", label: ACCESS_MODE_LABELS.FREE_REVIEW || RULE_LABELS.free, tone: "primary" },
  { mode: "PROCTORED_CLASS", label: ACCESS_MODE_LABELS.PROCTORED_CLASS || RULE_LABELS.once, tone: "warning" },
  { mode: "BLOCKED", label: ACCESS_MODE_LABELS.BLOCKED || RULE_LABELS.blocked, tone: "danger" },
];

export default function PermissionSidePanel({
  selectedCount,
  selectedStudents,
  onApply,
  onClear,
  onRemoveOne,
  pending,
}: {
  selectedCount: number;
  selectedStudents: any[];
  onApply: (rule: string) => void;
  onClear: () => void;
  onRemoveOne: (enrollment: number) => void;
  pending: boolean;
}) {
  const disabledApply = selectedCount === 0 || pending;

  return (
    <div className="permission-right">
      {/* HEADER */}
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-sm, 13px)" }}
              >
                선택된 학생
              </span>
              {selectedCount > 0 && (
                <span className="ds-status-badge ds-status-badge--1ch" data-tone="primary">
                  {selectedCount}
                </span>
              )}
            </div>
            <div
              className="mt-1 text-[var(--color-text-muted)]"
              style={{ fontSize: "var(--text-xs, 11px)" }}
            >
              {selectedCount > 0
                ? "아래 버튼으로 권한을 즉시 적용하세요."
                : "좌측에서 학생을 선택하세요."}
            </div>
          </div>

          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={onClear}
            disabled={selectedCount === 0}
            className="shrink-0"
          >
            선택 해제
          </Button>
        </div>

        {/* Apply buttons */}
        <div className="mt-3 flex items-center gap-2">
          {APPLY_ACTIONS.map(({ mode, label, tone }) => (
            <button
              key={mode}
              type="button"
              className="permission-apply-btn"
              data-tone={tone}
              disabled={disabledApply}
              onClick={() => onApply(mode)}
              title={`${label} 적용`}
            >
              {label}
            </button>
          ))}

          {pending && (
            <span
              className="ml-1 text-[var(--color-text-muted)]"
              style={{ fontSize: "var(--text-xs, 11px)" }}
            >
              적용 중...
            </span>
          )}
        </div>

        <div className="mt-2 text-[var(--color-text-muted)]" style={{ fontSize: "10px" }}>
          권한은 <b>선택된 학생</b> 기준으로 즉시 반영됩니다.
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 min-h-0 p-4">
        <div
          className="h-full overflow-hidden flex flex-col min-h-0"
          style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
          }}
        >
          {/* table head */}
          <div
            className="grid grid-cols-12 px-3 py-2 font-semibold border-b"
            style={{
              fontSize: "var(--text-xs, 11px)",
              color: "var(--color-text-tertiary)",
              borderColor: "var(--color-border-subtle)",
              background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
              letterSpacing: "0.01em",
            }}
          >
            <div className="col-span-2 text-center">출석</div>
            <div className="col-span-2 text-center">접근 모드</div>
            <div className="col-span-1 text-center">완료</div>
            <div className="col-span-3">이름</div>
            <div className="col-span-3">학부모 번호</div>
            <div className="col-span-1 text-right">삭제</div>
          </div>

          {/* table body */}
          <div className="flex-1 min-h-0 overflow-auto">
            {selectedStudents.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-1"
                style={{
                  padding: "var(--space-8)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-sm, 13px)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  선택된 학생이 없습니다.
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs, 11px)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  좌측 체크박스로 학생을 선택하세요.
                </span>
              </div>
            ) : (
              selectedStudents.map((s: any, idx: number) => (
                <div
                  key={s.enrollment}
                  className="grid grid-cols-12 px-3 py-2 items-center border-b"
                  style={{
                    borderColor: "var(--color-border-subtle)",
                    background:
                      idx % 2 === 1
                        ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                        : "var(--color-bg-surface)",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "var(--color-bg-surface-hover, var(--bg-surface-soft))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      idx % 2 === 1
                        ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                        : "var(--color-bg-surface)";
                  }}
                >
                  {/* 출석 */}
                  <div className="col-span-2 flex justify-center">
                    <AttendanceStatusBadge
                      status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                      variant="1ch"
                    />
                  </div>

                  {/* 접근 모드 */}
                  <div className="col-span-2 flex justify-center">
                    <span
                      className="ds-status-badge"
                      data-tone={getAccessTone(s.access_mode, s.effective_rule)}
                    >
                      {getAccessLabel(s.access_mode, s.effective_rule)}
                    </span>
                  </div>

                  {/* 완료 */}
                  <div className="col-span-1 flex justify-center">
                    <span
                      className="ds-status-badge ds-status-badge--1ch"
                      data-tone={s.completed ? "success" : "neutral"}
                    >
                      {s.completed ? "완료" : "미완료"}
                    </span>
                  </div>

                  {/* 이름 */}
                  <div className="col-span-3 min-w-0">
                    <div
                      className="font-semibold text-[var(--color-text-primary)] truncate"
                      style={{ fontSize: "var(--text-sm, 12px)" }}
                    >
                      <StudentNameWithLectureChip
                        name={s.student_name ?? ""}
                        profilePhotoUrl={s.profile_photo_url ?? undefined}
                        avatarSize={24}
                        lectures={
                          s.lecture_title
                            ? [{ lectureName: s.lecture_title, color: s.lecture_color }]
                            : undefined
                        }
                        chipSize={14}
                        clinicHighlight={(s as any).name_highlight_clinic_target === true}
                      />
                    </div>
                    <div
                      className="text-[var(--color-text-muted)] truncate"
                      style={{ fontSize: "10px" }}
                    >
                      {formatPhone(s.student_phone)}
                    </div>
                  </div>

                  {/* 학부모 번호 */}
                  <div
                    className="col-span-3 text-[var(--color-text-secondary)] truncate"
                    style={{ fontSize: "var(--text-sm, 12px)" }}
                  >
                    {formatPhone(s.parent_phone)}
                  </div>

                  {/* 삭제 */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveOne(s.enrollment)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] transition"
                      title="선택에서 제거"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="permission-right-footer">
        <Button
          type="button"
          intent="secondary"
          size="md"
          disabled={selectedCount === 0}
          onClick={onClear}
          className="w-full"
        >
          전체 선택 해제
        </Button>
      </div>
    </div>
  );
}
