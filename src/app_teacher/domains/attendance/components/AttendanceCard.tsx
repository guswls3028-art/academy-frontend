// PATH: src/app_teacher/domains/attendance/components/AttendanceCard.tsx
// 출석 카드 — 스와이프로 상태 변경, 탭으로 전체 상태 선택
import type { CSSProperties } from "react";

import { useSwipeGesture } from "../hooks/useSwipeGesture";
import {
  STATUS_CONFIG,
  type AttendanceListItem,
  type AttendanceStatus,
} from "../api";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import styles from "./AttendanceCard.module.css";

interface Props {
  record: AttendanceListItem;
  onStatusChange: (id: number, status: AttendanceStatus) => void;
  onTap: (record: AttendanceListItem) => void;
}

type AttendanceCardVars = CSSProperties & {
  "--attendance-swipe-bg": string;
  "--attendance-card-offset": string;
  "--attendance-card-transition": string;
  "--attendance-status-bg": string;
  "--attendance-status-color": string;
};

export default function AttendanceCard({
  record,
  onStatusChange,
  onTap,
}: Props) {
  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.PRESENT;
  const recordName = typeof record.name === "string" ? record.name : null;
  const studentName = recordName ?? record.student_name ?? "이름 없음";
  const lectureTitle = record.lecture_title;

  const { state, handlers } = useSwipeGesture({
    threshold: 80,
    onSwipeRight: () => onStatusChange(record.id, "PRESENT"),
    onSwipeLeft: () => onStatusChange(record.id, "ABSENT"),
  });

  const swipeBg = state.isSwiping
    ? state.direction === "right"
      ? `rgba(34,197,94,${Math.min(Math.abs(state.offsetX) / 200, 0.25)})`
      : `rgba(239,68,68,${Math.min(Math.abs(state.offsetX) / 200, 0.25)})`
    : "transparent";

  const offset = state.isSwiping ? `translateX(${state.offsetX}px)` : "translateX(0)";
  const cardVars: AttendanceCardVars = {
    "--attendance-swipe-bg": swipeBg,
    "--attendance-card-offset": offset,
    "--attendance-card-transition": state.isSwiping ? "none" : "transform 200ms ease",
    "--attendance-status-bg": cfg.bg,
    "--attendance-status-color": cfg.color,
  };

  const hint =
    state.isSwiping && Math.abs(state.offsetX) > 30
      ? state.direction === "right"
        ? "출석"
        : "결석"
      : null;

  return (
    <div
      className={styles.root}
      style={cardVars}
    >
      {/* Swipe hint */}
      {hint && (
        <div
          className={`${styles.hint} ${
            state.direction === "right" ? styles.hintRight : styles.hintLeft
          }`}
        >
          {hint}
        </div>
      )}

      {/* Card */}
      <div
        {...handlers}
        onClick={() => onTap(record)}
        className={styles.card}
      >
        {/* Left: student info */}
        <div className={styles.student}>
          <StudentNameWithLectureChip
            name={studentName}
            profilePhotoUrl={record.profile_photo_url}
            avatarSize={36}
            chipSize={18}
            lectures={lectureTitle ? [{
              lectureName: lectureTitle,
              color: record.lecture_color,
              chipLabel: record.lecture_chip_label,
            }] : undefined}
          />
        </div>

        {/* Right: status badge */}
        <div className={styles.statusBadge}>
          {cfg.label}
        </div>
      </div>
    </div>
  );
}
