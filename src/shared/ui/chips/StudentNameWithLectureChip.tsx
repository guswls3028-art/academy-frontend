// PATH: src/shared/ui/chips/StudentNameWithLectureChip.tsx
// 전역 규칙: 학생 이름이 등장하는 모든 곳에서 [아바타] + [이름] + [강의 딱지]
// 강의 없으면 딱지 없음. 학생 1명이 N개 강의 수강 시 딱지 N개 표시.

import React from "react";
import LectureChip from "./LectureChip";
import { LECTURE_CHIP_SIZE } from "./lectureChipTokens";
import { useClinicHighlight } from "@/shared/contexts/useClinicHighlight";
import "./StudentNameWithLectureChip.css";

export type LectureInfo = {
  lectureName?: string | null;
  color?: string | null;
  /** 강의 생성 모달에서 지정한 2글자 딱지 (미지정 시 제목 앞 2자) */
  chipLabel?: string | null;
};

type Props = {
  name: string;
  /** 강의 딱지(들). 수강 강의 1:1 — 없으면 아무 칩도 안 뜸 */
  lectures?: LectureInfo[] | null;
  /** 딱지 크기 */
  chipSize?: number;
  /** 프로필 사진 URL (있으면 표시, 없으면 이름 이니셜) */
  profilePhotoUrl?: string | null;
  /** 아바타 크기(px). 지정 시 이름 왼쪽에 아바타 표시. 미지정 시 아바타 없음 */
  avatarSize?: number;
  className?: string;
  highlight?: (text: string) => React.ReactNode;
  /** 클리닉 대상(미수강) 시 이름만 노란 형광펜 하이라이트 — 백엔드 name_highlight_clinic_target */
  clinicHighlight?: boolean;
  /** enrollment ID — clinicHighlight 미지정 시 전역 컨텍스트에서 자동 조회 */
  enrollmentId?: number | null;
  /** 좁은 표/피커 행에서는 한 줄 높이를 고정해 행 점프를 막는다. */
  density?: "default" | "compact";
  maxLectureChips?: number;
};

const DEFAULT_COLOR = "#3b82f6";

function avatarSizeClass(size?: number): string {
  if (size == null || size <= 0) return "";
  if (size <= 20) return "student-name-chip__avatar--20";
  if (size <= 24) return "student-name-chip__avatar--24";
  if (size <= 28) return "student-name-chip__avatar--28";
  return "student-name-chip__avatar--32";
}

export default function StudentNameWithLectureChip({
  name,
  lectures,
  chipSize = LECTURE_CHIP_SIZE.inline,
  profilePhotoUrl,
  avatarSize,
  className,
  highlight,
  clinicHighlight,
  enrollmentId,
  density = "default",
  maxLectureChips,
}: Props) {
  const contextHighlight = useClinicHighlight(enrollmentId);
  const isClinicHighlight = clinicHighlight ?? contextHighlight;
  const list = Array.isArray(lectures) && lectures.length > 0
    ? lectures
    : [];
  const chipSizeResolved = chipSize;
  const avatarClass = avatarSizeClass(avatarSize);
  const displayedLectures = Number.isFinite(maxLectureChips)
    ? list.slice(0, Math.max(0, Number(maxLectureChips)))
    : list;
  const hiddenLectureCount = list.length - displayedLectures.length;

  const rootClass = [
    "student-name-chip",
    className ?? "",
  ].filter(Boolean).join(" ");
  const nameNode = (
    <span className={`student-name-chip__name ${isClinicHighlight ? "ds-student-name--clinic-highlight" : ""}`}>
      {highlight ? highlight(name || "-") : (name || "-")}
    </span>
  );

  return (
    <span className={rootClass} data-density={density}>
      {avatarSize != null && avatarSize > 0 && (
        <span
          className={`student-name-chip__avatar ${avatarClass}`}
          aria-hidden
        >
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (name || "?")[0]
          )}
        </span>
      )}

      <span className="student-name-chip__body">
        {nameNode}
      </span>
      {displayedLectures.map((lec, i) => (
        <LectureChip
          key={`${lec.lectureName ?? ""}-${i}`}
          lectureName={lec.lectureName}
          color={lec.color ?? DEFAULT_COLOR}
          size={chipSizeResolved}
          chipLabel={lec.chipLabel}
        />
      ))}
      {hiddenLectureCount > 0 && (
        <span className="student-name-chip__more" title={`강의 ${hiddenLectureCount}개 더 있음`}>
          +{hiddenLectureCount}
        </span>
      )}
    </span>
  );
}
