// PATH: src/shared/ui/chips/LectureChip.tsx
// 수강 강의 딱지 — 네모(정사각형), 두 글자 중앙정렬, 아바타와 동일 크기로 맞출 때 size=avatarSize

const DEFAULT_LECTURE_COLOR = "#3b82f6";

function isLightColor(hex: string): boolean {
  const c = String(hex || "").toLowerCase();
  return ["#eab308", "#06b6d4"].includes(c);
}

export default function LectureChip({
  lectureName,
  color,
  size = 18,
  chipLabel,
}: {
  lectureName: string;
  color?: string;
  size?: number;
  /** 강의 생성 시 지정한 2글자 (미지정 시 제목 앞 2자) */
  chipLabel?: string | null;
}) {
  const bg = color || DEFAULT_LECTURE_COLOR;
  const textColor = isLightColor(bg) ? "#1a1a1a" : "#fff";
  const two = (chipLabel && chipLabel.length >= 1)
    ? String(chipLabel).slice(0, 2)
    : (lectureName || "??").slice(0, 2);
  const fontSize = size <= 18 ? 8 : size <= 24 ? 9 : 10;

  return (
    <span
      data-lecture-chip
      title={lectureName}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 4,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: textColor,
        background: bg,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
      }}
    >
      {two}
    </span>
  );
}
