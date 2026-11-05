import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { SelectionButton } from "@/shared/ui/ds";
import { useFloatingPosition } from "@/shared/ui/floating/useFloatingPosition";
import { ATTENDANCE_META, ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";

type Props = {
  studentName: string;
  value: AttendanceStatus;
  pending: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  onChange: (status: AttendanceStatus) => void;
  onClose: (restoreFocus?: boolean) => void;
};

export default function AttendanceStatusPicker({ studentName, value, pending, triggerRef, onChange, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(triggerRef, popoverRef, true, {
    placement: "top", gap: 4, margin: 8, estimateHeight: 90, estimateWidth: 420,
  });
  const positioned = position != null;
  useEffect(() => {
    if (positioned) popoverRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')?.focus();
  }, [positioned]);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) onClose();
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [onClose, triggerRef]);
  if (!position) return null;
  const floatingStyle = { left: position.left, top: position.top };
  return createPortal(
    <div ref={popoverRef} role="group" aria-label={`${studentName} 출결 상태 선택`}
      className="attendance-popover attendance-popover--status-picker fixed flex items-center gap-2 rounded-lg border p-2 shadow-lg z-[9999]"
      style={floatingStyle}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation(); onClose(true);
        }
      }}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)
          && event.relatedTarget !== triggerRef.current) onClose();
      }}>
      {ORDERED_ATTENDANCE_STATUS.map(code => {
        const active = value === code;
        return <SelectionButton key={code} type="button" className="attendance-popover-item"
          label={ATTENDANCE_META[code].label} selected={active}
          tone={active || code === "INACTIVE" || code === "SECESSION" ? ATTENDANCE_META[code].tone : "neutral"}
          size="sm" data-active={active ? "true" : "false"}
          data-critical={code === "INACTIVE" || code === "SECESSION" ? "true" : undefined}
          data-status-code={code.toLowerCase()} disabled={pending} onClick={() => onChange(code)} />;
      })}
    </div>, document.body,
  );
}
