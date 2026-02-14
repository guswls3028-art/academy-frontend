// PATH: src/shared/ui/chips/StudentNameWithLectureChip.tsx
// 전역 규칙: 학생 이름이 등장하는 모든 곳에서 [아바타] + 강의 딱지(수강 강의 1:1) + 이름
// 강의 없으면 딱지 없음. 학생 1명이 N개 강의 수강 시 딱지 N개 표시.

import React from "react";
import LectureChip from "./LectureChip";

export type LectureInfo = {
  lectureName: string;
  color?: string | null;
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
};

const DEFAULT_COLOR = "#3b82f6";

export default function StudentNameWithLectureChip({
  name,
  lectures,
  chipSize = 16,
  profilePhotoUrl,
  avatarSize,
  className,
  highlight,
}: Props) {
  const list = Array.isArray(lectures) && lectures.length > 0
    ? lectures
    : [];

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className ?? ""}`.trim()}>
      {avatarSize != null && avatarSize > 0 && (
        <span
          className="flex-shrink-0 rounded-full overflow-hidden bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary)] text-xs font-bold flex items-center justify-center"
          style={{ width: avatarSize, height: avatarSize }}
          aria-hidden
        >
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (name || "?")[0]
          )}
        </span>
      )}
      {list.map((lec, i) => (
        <LectureChip
          key={`${lec.lectureName ?? ""}-${i}`}
          lectureName={lec.lectureName || "??"}
          color={lec.color ?? DEFAULT_COLOR}
          size={chipSize}
        />
      ))}
      <span className="truncate">
        {highlight ? highlight(name || "-") : (name || "-")}
      </span>
    </span>
  );
}
