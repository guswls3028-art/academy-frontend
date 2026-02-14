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
}: {
  lectureName: string;
  color?: string;
  size?: number;
}) {
  const bg = color || DEFAULT_LECTURE_COLOR;
  const textColor = isLightColor(bg) ? "#1a1a1a" : "#fff";
  const two = (lectureName || "??").slice(0, 2);
  const fontSize = size <= 18 ? 10 : size <= 24 ? 11 : 12;

  return (
    <span
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
