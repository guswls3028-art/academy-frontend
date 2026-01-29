export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BBoxMeta = {
  bbox: BBox;
  label?: string;
  confidence?: number;
  invalid_reason?: string;
};
