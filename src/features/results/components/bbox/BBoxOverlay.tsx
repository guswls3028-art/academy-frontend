// PATH: src/features/results/components/bbox/BBoxOverlay.tsx
import { useMemo } from "react";
import BBoxLayer from "./BBoxLayer";
import { BBoxMeta } from "./types";

type Props = {
  src: string;                // image or rendered PDF page
  width: number;              // display width
  originalWidth: number;      // backend 기준 원본 width
  boxes: BBoxMeta[];
};

export default function BBoxOverlay({
  src,
  width,
  originalWidth,
  boxes,
}: Props) {
  const scale = useMemo(
    () => width / originalWidth,
    [width, originalWidth]
  );

  return (
    <div className="relative">
      <img src={src} style={{ width }} />

      {boxes.map((b) => (
        <BBoxLayer
          /**
           * 🔥 FIX: index key 제거
           *
           * bbox 좌표 자체가 "문항 영역의 정체성"
           * - 좌표가 같으면 같은 박스
           * - 좌표가 바뀌면 다른 박스
           *
           * invalid_reason / confidence 변경에도
           * React reconciliation 안전
           */
          key={`${b.bbox.x}-${b.bbox.y}-${b.bbox.width}-${b.bbox.height}`}
          meta={b}
          scale={scale}
        />
      ))}
    </div>
  );
}
