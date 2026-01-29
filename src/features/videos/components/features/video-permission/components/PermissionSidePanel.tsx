// PATH: src/features/videos/components/features/video-permission/components/PermissionSidePanel.tsx

import AttendanceBadge from "@/shared/ui/attendance/AttendanceBadge";
import { RULE_COLORS, RULE_LABELS } from "../permission.constants";

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
  tone: "free" | "once" | "blocked";
  disabled: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "blocked"
      ? "bg-[color-mix(in_srgb,var(--color-danger)_92%,black)] hover:bg-[color-mix(in_srgb,var(--color-danger)_84%,black)] text-white"
      : tone === "once"
      // ✅ 1회 제한: 노랑 하드코딩 (가시성 최우선)
      ? "bg-yellow-400 hover:bg-yellow-500 border border-yellow-500 text-black"
      : "bg-[color-mix(in_srgb,var(--color-primary)_92%,black)] hover:bg-[color-mix(in_srgb,var(--color-primary)_84%,black)] text-white";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "h-8 px-3 rounded-md text-xs font-semibold transition",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        toneClass
      )}
      title={`${label} 적용`}
    >
      {label}
    </button>
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

          <button
            type="button"
            onClick={onClear}
            disabled={selectedCount === 0}
            className="shrink-0 h-8 px-3 rounded-md border border-[var(--border-divider)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] disabled:opacity-40"
          >
            선택 해제
          </button>
        </div>

        {/* 권한 적용 버튼 */}
        <div className="mt-3 flex items-center gap-2">
          <ApplyPillButton
            label={RULE_LABELS.free}
            tone="free"
            disabled={disabledApply}
            onClick={() => onApply("free")}
          />
          <ApplyPillButton
            label={RULE_LABELS.once}
            tone="once"
            disabled={disabledApply}
            onClick={() => onApply("once")}
          />
          <ApplyPillButton
            label={RULE_LABELS.blocked}
            tone="blocked"
            disabled={disabledApply}
            onClick={() => onApply("blocked")}
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
            <div className="col-span-2 text-center">권한</div>
            <div className="col-span-4">이름</div>
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
                  {/* 출석 */}
                  <div className="col-span-2 flex justify-center">
                    <div className="scale-[0.92] origin-center">
                      <AttendanceBadge
                        status={s.attendance_status ?? "UNKNOWN"}
                      />
                    </div>
                  </div>

                  {/* 권한 */}
                  <div className="col-span-2 flex justify-center">
                    <span
                      className={cx(
                        "inline-flex items-center justify-center",
                        "h-[22px] px-2 rounded-full",
                        "text-[11px] font-semibold leading-none text-white",
                        RULE_COLORS[s.effective_rule] || "bg-gray-500"
                      )}
                    >
                      {RULE_LABELS[s.effective_rule] || "-"}
                    </span>
                  </div>

                  {/* 이름 */}
                  <div className="col-span-4 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {s.student_name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">
                      학생번호 {s.student_phone || "-"}
                    </div>
                  </div>

                  {/* 학부모 번호 */}
                  <div className="col-span-3 text-sm text-[var(--text-secondary)] truncate">
                    {s.parent_phone || "-"}
                  </div>

                  {/* 삭제 */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveOne(s.enrollment)}
                      className="h-7 w-10 rounded-md border border-[var(--border-divider)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                      title="선택에서 제거"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-[var(--border-divider)]">
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onClear}
          className="w-full h-9 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] disabled:opacity-40"
        >
          전체 선택 해제
        </button>
      </div>
    </div>
  );
}
