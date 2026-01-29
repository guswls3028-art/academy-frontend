import BBoxOverlay from "../bbox/BBoxOverlay";
import { BBoxMeta } from "../bbox/types";

/**
 * ✅ AttemptOMRViewer
 *
 * 책임:
 * - 선택된 문항의 meta.omr.bbox 를 화면에 표시
 * - invalid_reason 시각적 강조
 */
type Props = {
  imageSrc: string;
  fact: {
    meta?: any;
  } | null;
  originalWidth: number;
  displayWidth: number;
};

export default function AttemptOMRViewer({
  imageSrc,
  fact,
  originalWidth,
  displayWidth,
}: Props) {
  if (!fact) {
    return (
      <div className="flex h-64 items-center justify-center rounded border text-sm text-gray-400">
        문항을 선택하세요
      </div>
    );
  }

  const omr = fact.meta?.omr;
  if (!omr?.bbox) {
    return (
      <div className="flex h-64 items-center justify-center rounded border text-sm text-gray-400">
        BBox 정보 없음
      </div>
    );
  }

  const invalidReason = fact.meta?.grading?.invalid_reason;

  const boxes: BBoxMeta[] = [
    {
      bbox: omr.bbox,
      label: invalidReason ?? "OMR",
      confidence: omr.confidence,
      invalid_reason: invalidReason,
    },
  ];

  return (
    <div className="rounded border p-2">
      <BBoxOverlay
        src={imageSrc}
        width={displayWidth}
        originalWidth={originalWidth}
        boxes={boxes}
      />
    </div>
  );
}
