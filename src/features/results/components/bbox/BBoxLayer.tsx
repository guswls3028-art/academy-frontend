// PATH: src/features/results/components/bbox/BBoxLayer.tsx
import { BBoxMeta } from "./types";

type Props = {
  meta: BBoxMeta;
  scale: number;
};

export default function BBoxLayer({ meta, scale }: Props) {
  const { bbox } = meta;

  return (
    <div
      className="absolute border-2 border-red-500 bg-red-200/20 pointer-events-none"
      style={{
        left: bbox.x * scale,
        top: bbox.y * scale,
        width: bbox.width * scale,
        height: bbox.height * scale,
      }}
    >
      {meta.label && (
        <div className="absolute -top-5 left-0 rounded bg-red-600 px-1 text-[10px] text-white">
          {meta.label}
        </div>
      )}
    </div>
  );
}
