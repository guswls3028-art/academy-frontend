// PATH: src/app_admin/domains/videos/components/features/video-permission/components/PermissionSidePanel.tsx

import { FiX } from "react-icons/fi";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import type { AttendanceStatus } from "@/shared/ui/badges/AttendanceStatusBadge";
import { Badge, Button } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";
import { isVideoProgressComplete } from "@/shared/api/contracts/videos";
import type { AccessMode } from "@admin/domains/videos/types/access-mode";
import { ACCESS_MODE_LABELS, RULE_LABELS, getAccessLabel, getAccessTone } from "../permission.constants";
import type { PermissionStudent } from "../permission.types";

type ApplyTone = "primary" | "warning" | "danger";

const APPLY_ACTIONS: { mode: AccessMode; label: string; tone: ApplyTone }[] = [
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
  selectedStudents: PermissionStudent[];
  onApply: (rule: AccessMode) => void;
  onClear: () => void;
  onRemoveOne: (enrollment: number) => void;
  pending: boolean;
}) {
  const disabledApply = selectedCount === 0 || pending;

  return (
    <div className="permission-right">
      {/* HEADER */}
      <div className="permission-right-head">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="permission-right-title">
                선택된 학생
              </span>
              {selectedCount > 0 && (
                <Badge variant="solid" tone="primary" oneChar>
                  {selectedCount}
                </Badge>
              )}
            </div>
            <div className="permission-right-subtitle">
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
            <span className="permission-pending">
              적용 중...
            </span>
          )}
        </div>

        <div className="permission-apply-note">
          권한은 <b>선택된 학생</b> 기준으로 즉시 반영됩니다.
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 min-h-0 p-4">
        <div className="permission-right-listWrap">
          {/* table head */}
          <div className="permission-right-listHeader">
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
              <div className="permission-selected-empty">
                <span className="permission-selected-empty-title">
                  선택된 학생이 없습니다.
                </span>
                <span className="permission-selected-empty-subtitle">
                  좌측 체크박스로 학생을 선택하세요.
                </span>
              </div>
            ) : (
              selectedStudents.map((s, idx) => {
                const completed = isVideoProgressComplete(s.progress, s.completed);

                return (
                  <div
                    key={s.enrollment}
                    className={[
                      "permission-right-row",
                      idx % 2 === 1 && "permission-right-row-alt",
                    ].filter(Boolean).join(" ")}
                  >
                  {/* 출석 */}
                  <div className="col-span-2 flex justify-center">
                    <AttendanceStatusBadge
                      status={(s.attendance_status ?? "INACTIVE") as AttendanceStatus}
                      variant="2ch"
                    />
                  </div>

                  {/* 접근 모드 */}
                  <div className="col-span-2 flex justify-center">
                    <Badge
                      variant="solid"
                      tone={getAccessTone(s.access_mode, s.effective_rule)}
                    >
                      {getAccessLabel(s.access_mode, s.effective_rule)}
                    </Badge>
                  </div>

                  {/* 완료 */}
                  <div className="col-span-1 flex justify-center">
                    <Badge
                      variant="solid"
                      tone={completed ? "success" : "neutral"}
                    >
                      {completed ? "완료" : "미완"}
                    </Badge>
                  </div>

                  {/* 이름 */}
                  <div className="col-span-3 min-w-0">
                    <div className="permission-selected-name">
                      <StudentNameWithLectureChip
                        name={s.student_name ?? ""}
                        profilePhotoUrl={s.profile_photo_url ?? undefined}
                        avatarSize={24}
                        lectures={
                          s.lecture_title
                            ? [{ lectureName: s.lecture_title, color: s.lecture_color, chipLabel: s.lecture_chip_label }]
                            : undefined
                        }
                        chipSize={14}
                        clinicHighlight={s.name_highlight_clinic_target === true}
                      />
                    </div>
                    <div className="permission-selected-phone">
                      {formatPhone(s.student_phone)}
                    </div>
                  </div>

                  {/* 학부모 번호 */}
                  <div className="permission-selected-parent-phone">
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
                );
              })
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
