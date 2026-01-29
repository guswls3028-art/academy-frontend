// PATH: src/features/results/components/bbox/types.ts

export type BBox = {
  x: number;      // left (px)
  y: number;      // top (px)
  width: number;
  height: number;
};

export type BBoxMeta = {
  bbox: BBox;
  label?: string;          // e.g. "Q3"
  confidence?: number;     // optional
  invalid_reason?: string; // LOW_CONFIDENCE 등
};
