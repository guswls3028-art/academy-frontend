// PATH: src/features/videos/components/features/video-permission/components/PermissionSidePanel.tsx

import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import { Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";
import { RULE_COLORS, RULE_LABELS, ACCESS_MODE_LABELS, getAccessLabel, getAccessColor } from "../permission.constants";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function ApplyPillButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: "free" | "once" | "blocked" | "FREE_REVIEW" | "PROCTORED_CLASS" | "BLOCKED";
  disabled: boolean;
  onClick: () => void;
}) {
  const isProctored = tone === "once" || tone === "PROCTORED_CLASS";
  const isBlocked = tone === "blocked" || tone === "BLOCKED";
  const intent = isBlocked ? "danger" : isProctored ? "secondary" : "primary";
  const onceClass = isProctored ? "!bg-yellow-400 hover:!bg-yellow-500 !border-yellow-500 !text-black" : "";

  return (
    <Button
      type="button"
      intent={intent}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cx("text-xs", onceClass)}
      title={`${label} 적용`}
    >
      {label}
    </Button>
  );
}

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
      <div className="px-4 py-3 border-b border-[var(--border-divider)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              선택된 학생
            </div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              {selectedCount > 0
                ? `${selectedCount}명 선택됨`
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

        {/* 권한 적용 버튼 */}
        <div className="mt-3 flex items-center gap-2">
          <ApplyPillButton
            label={ACCESS_MODE_LABELS.FREE_REVIEW || RULE_LABELS.free}
            tone="FREE_REVIEW"
            disabled={disabledApply}
            onClick={() => onApply("FREE_REVIEW")}
          />
          <ApplyPillButton
            label={ACCESS_MODE_LABELS.PROCTORED_CLASS || RULE_LABELS.once}
            tone="PROCTORED_CLASS"
            disabled={disabledApply}
            onClick={() => onApply("PROCTORED_CLASS")}
          />
          <ApplyPillButton
            label={ACCESS_MODE_LABELS.BLOCKED || RULE_LABELS.blocked}
            tone="BLOCKED"
            disabled={disabledApply}
            onClick={() => onApply("BLOCKED")}
          />

          {pending && (
            <span className="ml-1 text-xs text-[var(--text-muted)]">
              적용 중...
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
          * 권한은 <b>선택된 학생</b> 기준으로 즉시 반영됩니다.
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden flex flex-col min-h-0">
          {/* table head */}
          <div className="
            grid grid-cols-12
            px-3 py-2
            text-xs font-semibold
            text-[var(--text-secondary)]
            border-b border-[var(--border-divider)]
            bg-[var(--bg-surface-soft)]
          ">
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
              <div className="p-6 text-sm text-[var(--text-muted)]">
                선택된 학생이 없습니다. <br />
                <span className="text-xs">
                  좌측 체크 → 우측 상단에서 권한을 바로 적용하세요.
                </span>
              </div>
            ) : (
              selectedStudents.map((s: any) => (
                <div
                  key={s.enrollment}
                  className="grid grid-cols-12 px-3 py-2 items-center border-b border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                >
                  {/* 출석 — SSOT: AttendanceStatusBadge 1ch */}
                  <div className="col-span-2 flex justify-center">
                    <AttendanceStatusBadge
                      status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                      variant="1ch"
                    />
                  </div>

                  {/* 접근 모드 — SSOT: ds-status-badge (2ch) */}
                  <div className="col-span-2 flex justify-center">
                    <span
                      className={cx(
                        "ds-status-badge",
                        getAccessColor(s.access_mode, s.effective_rule)
                          .split(/\s+/)
                          .map((c) => (c.startsWith("bg-") || c.startsWith("text-") ? `!${c}` : c))
                          .join(" "),
                        "!text-white"
                      )}
                    >
                      {getAccessLabel(s.access_mode, s.effective_rule)}
                    </span>
                  </div>

                  {/* 완료 */}
                  <div className="col-span-1 flex justify-center">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {s.completed ? "완료" : "미완료"}
                    </span>
                  </div>

                  {/* 이름 + 강의 딱지 (전역 규칙) */}
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      <StudentNameWithLectureChip
                        name={s.student_name ?? ""}
                        lectures={
                          s.lecture_title
                            ? [{ lectureName: s.lecture_title, color: s.lecture_color }]
                            : undefined
                        }
                        chipSize={14}
                      />
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">
                      학생번호 {formatPhone(s.student_phone)}
                    </div>
                  </div>

                  {/* 학부모 번호 */}
                  <div className="col-span-3 text-sm text-[var(--text-secondary)] truncate">
                    {formatPhone(s.parent_phone)}
                  </div>

                  {/* 삭제 */}
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      onClick={() => onRemoveOne(s.enrollment)}
                      className="!min-w-0 !w-10 !h-7"
                      title="선택에서 제거"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-[var(--border-divider)]">
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
