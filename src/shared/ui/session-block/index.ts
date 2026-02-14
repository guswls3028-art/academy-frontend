// PATH: src/shared/ui/session-block/index.ts
// 차시 블록 SSOT (Single Source of Truth)
// - 스타일: session-block.css
// - 마크업·클래스: SessionBlockView + session-block.constants
// 모달·세션바·세션 목록 등 모든 차시 블록은 여기서 import.

import "@/styles/design-system/components/session-block.css";

export { SessionBlockView } from "./SessionBlockView";
export type { SessionBlockViewProps } from "./SessionBlockView";
export {
  SESSION_BLOCK_CLASS,
  sessionBlockClassNames,
  isSupplement,
} from "./session-block.constants";
export type { SessionBlockVariant } from "./session-block.constants";
