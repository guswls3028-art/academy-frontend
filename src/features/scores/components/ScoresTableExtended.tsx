// PATH: src/features/scores/components/ScoresTableExtended.tsx
/**
 * ScoresTableExtended (LEGACY BRIDGE)
 * - 기존 import가 남아있을 수 있어 브릿지로 유지
 * - 현재는 ScoresTable을 그대로 렌더링
 *
 * ⚠️ 중첩 <table> 만들던 이전 구현은 제거(깨지는 구조였음)
 */

import ScoresTable from "./ScoresTable";
import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;
  selectedEnrollmentId: number | null;
  onSelectRow: (row: SessionScoreRow) => void;
};

export default function ScoresTableExtended(props: Props) {
  return <ScoresTable {...props} />;
}
