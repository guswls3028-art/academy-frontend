/**
 * PATH: src/features/scores/types.ts
 *
 * ✅ Scores Domain Types
 */

export type EditableScoreCell = {
  exam_id: number;
  enrollment_id: number;
  question_id: number;
  score: number | null;
  max_score: number;
  is_editable: boolean;
  is_locked: boolean;
};
