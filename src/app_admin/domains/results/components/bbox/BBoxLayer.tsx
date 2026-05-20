// PATH: src/app_admin/domains/results/components/bbox/BBoxLayer.tsx
import { BBoxMeta } from "./types";

type Props = {
  meta: BBoxMeta;
  scale: number;
};

export default function BBoxLayer({ meta, scale }: Props) {
  const { bbox } = meta;

  return (
    <div
      className="bbox-layer"
      // eslint-disable-next-line no-restricted-syntax -- bbox geometry is calculated from backend coordinates and image scale.
      style={{
        left: bbox.x * scale,
        top: bbox.y * scale,
        width: bbox.width * scale,
        height: bbox.height * scale,
      }}
    >
      {meta.label && (
        <div className="bbox-layer__label">
          {meta.label}
        </div>
      )}
    </div>
  );
}
