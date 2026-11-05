import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, SelectionButton } from "@/shared/ui/ds";
import { ATTENDANCE_META, ORDERED_ATTENDANCE_STATUS, type AttendanceStatus } from "@/shared/ui/badges/attendanceStatus";
import { useFloatingPosition } from "@/shared/ui/floating/useFloatingPosition";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function AttendanceStatusFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const anchor = useFloatingPosition(triggerRef, popoverRef, open, {
    placement: "top",
    gap: 4,
    margin: 8,
    estimateHeight: 90,
    estimateWidth: 420,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function select(status: string) {
    onChange(status);
    setOpen(false);
  }

  return (
    <>
      <span ref={triggerRef}>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="출결 상태 필터"
        >
          {value ? ATTENDANCE_META[value as AttendanceStatus].label : "상태필터"}
        </Button>
      </span>
      {open && anchor && createPortal(
        <div
          ref={popoverRef}
          className="attendance-popover fixed flex items-center gap-2 rounded-lg border p-2 shadow-lg"
          style={{
            left: anchor.left,
            top: anchor.top,
            zIndex: 9999,
            background: "var(--color-bg-surface)",
            borderColor: "var(--color-border-divider)",
            maxWidth: `${window.innerWidth - 16}px`,
            overflowX: "auto",
            flexWrap: "nowrap",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <SelectionButton
            type="button"
            selected={!value}
            label="전체"
            size="sm"
            className="attendance-popover-item"
            onClick={() => select("")}
          />
          {ORDERED_ATTENDANCE_STATUS.map((code) => {
            const selected = value === code;
            return (
              <SelectionButton
                key={code}
                type="button"
                className="attendance-popover-item"
                label={ATTENDANCE_META[code].label}
                selected={selected}
                tone={selected || code === "INACTIVE" || code === "SECESSION" ? ATTENDANCE_META[code].tone : "neutral"}
                size="sm"
                onClick={() => select(code)}
              />
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
