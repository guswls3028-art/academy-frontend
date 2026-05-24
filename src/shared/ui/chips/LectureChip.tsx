// PATH: src/shared/ui/chips/LectureChip.tsx
// 수강 강의 딱지 — 네모(정사각형), 두 글자 중앙정렬, 아바타와 동일 크기로 맞출 때 size=avatarSize

import type { CSSProperties } from "react";
import { contrastTextColor } from "@/shared/ui/domain/constants";
import { normalizeLectureChipText } from "./lectureChipText";
import "./LectureChip.css";

const DEFAULT_LECTURE_COLOR = "#3b82f6";

type LectureChipStyle = CSSProperties & {
  "--lecture-chip-size": string;
  "--lecture-chip-font-size": string;
  "--lecture-chip-text-color": string;
  "--lecture-chip-bg": string;
};

export default function LectureChip({
  lectureName,
  color,
  size = 22,
  chipLabel,
}: {
  lectureName: string;
  color?: string;
  size?: number;
  /** 강의 생성 시 지정한 2글자 (미지정 시 제목 앞 2자) */
  chipLabel?: string | null;
}) {
  const bg = color || DEFAULT_LECTURE_COLOR;
  const textColor = contrastTextColor(bg);
  const chipSize = Number.isFinite(size) && size > 0 ? size : 22;
  // 강의명 미설정/누락 시 "??" 같은 의문스러운 라벨 대신 chip 자체 미렌더
  // (예전 동작: 빈 파란 박스 노출 → 학생/시험 카드 시각 노이즈로 학원장이 정보로 오인)
  const two = normalizeLectureChipText(chipLabel) || normalizeLectureChipText(lectureName);
  if (!two) return null;
  const fontSize = getLectureChipFontSize(chipSize, two);
  const chipStyle: LectureChipStyle = {
    "--lecture-chip-size": `${chipSize}px`,
    "--lecture-chip-font-size": `${fontSize}px`,
    "--lecture-chip-text-color": textColor,
    "--lecture-chip-bg": bg,
  };

  return (
    <span
      data-lecture-chip
      title={lectureName}
      className="lecture-chip"
      style={chipStyle}
    >
      {two}
    </span>
  );
}

function getLectureChipFontSize(chipSize: number, label: string): number {
  const chars = Array.from(label);
  const hasWideGlyph = chars.some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f);
  if (chars.length >= 2 && hasWideGlyph) {
    return Math.max(8, Math.min(18, Math.floor(chipSize * 0.46)));
  }
  if (chars.length >= 2) {
    return Math.max(9, Math.min(18, Math.floor(chipSize * 0.55)));
  }
  return Math.max(10, Math.min(18, Math.floor(chipSize * 0.62)));
}
