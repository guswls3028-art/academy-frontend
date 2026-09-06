export type ScoreLetterInitialState = {
  body: string;
  templateId: null;
};

/**
 * A lesson-result send never inherits a saved/default/recent/preset letter.
 * The approved provider envelope is automatic; #{선생님메모} is an explicit
 * per-send snapshot selected or authored in the modal.
 */
export function createExplicitScoreLetterState(): ScoreLetterInitialState {
  return { body: "", templateId: null };
}
