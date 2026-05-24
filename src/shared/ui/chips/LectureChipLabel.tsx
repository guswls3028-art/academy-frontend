import LectureChip from "./LectureChip";
import { normalizeLectureChipText } from "./lectureChipText";
import { LECTURE_CHIP_SIZE } from "./lectureChipTokens";
import "./LectureChipLabel.css";

type Props = {
  lectureName?: string | null;
  color?: string | null;
  chipLabel?: string | null;
  size?: number;
  className?: string;
};

export default function LectureChipLabel({
  lectureName,
  color,
  chipLabel,
  size = LECTURE_CHIP_SIZE.compact,
  className,
}: Props) {
  const label = lectureName?.trim() || normalizeLectureChipText(chipLabel);
  if (!label) return null;

  return (
    <span
      data-lecture-chip-label
      className={["lecture-chip-label", className ?? ""].filter(Boolean).join(" ")}
      title={lectureName ?? label}
    >
      <LectureChip
        lectureName={lectureName}
        color={color ?? undefined}
        chipLabel={chipLabel}
        size={size}
      />
      <span className="lecture-chip-label__text">{label}</span>
    </span>
  );
}
