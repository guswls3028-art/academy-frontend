// PATH: src/app_teacher/domains/attendance/components/StatusBottomSheet.tsx
// 출석 상태 선택 바텀시트 — 6개 주요 상태
import type { CSSProperties } from "react";
import { useEffect } from "react";
import {
  STATUS_CONFIG,
  QUICK_STATUSES,
  type AttendanceListItem,
  type AttendanceStatus,
} from "../api";
import styles from "./StatusBottomSheet.module.css";

interface Props {
  open: boolean;
  record: AttendanceListItem | null;
  onSelect: (id: number, status: AttendanceStatus) => void;
  onClose: () => void;
}

type StatusOptionVars = CSSProperties & {
  "--attendance-option-color": string;
  "--attendance-option-bg": string;
};

export default function StatusBottomSheet({
  open,
  record,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !record) return null;
  const studentName = record.name ?? record.student_name ?? "학생";

  return (
    <>
      <div
        onClick={onClose}
        className={styles.backdrop}
      />
      <div className={styles.sheet}>
        {/* Handle */}
        <div className={styles.handleWrap}>
          <div className={styles.handle} />
        </div>

        {/* Title */}
        <div className={styles.title}>
          {studentName} 출석 상태
        </div>

        {/* Status grid */}
        <div className={styles.grid}>
          {QUICK_STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const active = record.status === status;
            const optionVars: StatusOptionVars = {
              "--attendance-option-color": cfg.color,
              "--attendance-option-bg": cfg.bg,
            };
            return (
              <button
                key={status}
                onClick={() => {
                  onSelect(record.id, status);
                  onClose();
                }}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                style={optionVars}
              >
                <span className={styles.optionLabel}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
