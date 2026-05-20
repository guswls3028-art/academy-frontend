import type { BBox } from "../bbox/types";

export type AttemptFactMeta = {
  omr?: {
    bbox?: BBox;
    confidence?: number;
    image_url?: string;
    imageUrl?: string;
    page_image_url?: string;
    original_width?: number;
    originalWidth?: number;
  };
  grading?: {
    invalid_reason?: string | null;
  };
  image_url?: string;
  imageUrl?: string;
  original_width?: number;
  originalWidth?: number;
  [key: string]: unknown;
};
