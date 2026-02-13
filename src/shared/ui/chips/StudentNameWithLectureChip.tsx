// PATH: src/shared/ui/chips/StudentNameWithLectureChip.tsx
// 전역 규칙: 학생 이름이 등장하는 모든 곳에서 앞에 강의 딱지 표시 (백엔드에서 lecture_title/lecture_color 또는 enrollments 제공)

import React from "react";
import LectureChip from "./LectureChip";

export type LectureInfo = {
  lectureName: string;
  color?: string | null;
};

type Props = {
  name: string;
  /** 강의 딱지(들). 단일 강의 컨텍스트면 1개, 학생 목록이면 수강 강의 여러 개 */
  lectures?: LectureInfo[] | null;
  /** 딱지 크기 */
  chipSize?: number;
  /** 이름만 표시할 때 (truncate 등) 적용할 className */
  className?: string;
  /** 이름 하이라이트용 (예: 검색어 강조) */
  highlight?: (text: string) => React.ReactNode;
};

const DEFAULT_COLOR = "#3b82f6";

export default function StudentNameWithLectureChip({
  name,
  lectures,
  chipSize = 16,
  className,
  highlight,
}: Props) {
  const list = Array.isArray(lectures) && lectures.length > 0
    ? lectures.slice(0, 5)
    : [];

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className ?? ""}`.trim()}>
      {list.map((lec, i) => (
        <LectureChip
          key={i}
          lectureName={lec.lectureName || "??"}
          color={lec.color ?? DEFAULT_COLOR}
          size={chipSize}
        />
      ))}
      {list.length === 0 && (
        <LectureChip lectureName="-" color={DEFAULT_COLOR} size={chipSize} />
      )}
      <span className="truncate">
        {highlight ? highlight(name || "-") : (name || "-")}
      </span>
    </span>
  );
}
