// PATH: src/shared/ui/chips/LectureChip.tsx
// 학생 정보 표시 영역 공통 — 수강 강의 딱지 (students 도메인과 동일)

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

  return (
    <span
      title={lectureName}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        flexShrink: 0,
        display: "inline-grid",
        placeItems: "center",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: textColor,
        background: bg,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
      }}
    >
      {two}
    </span>
  );
}
