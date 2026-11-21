import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = stripTypeScriptTypes(readFileSync(new URL(
  "../../src/shared/ui/asyncStatus/omrGradingAttention.ts", import.meta.url,
), "utf8"));
const { omrGradingAttentionCount } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const batch = (fields = {}) => ({ terminal: true, counts: { completed: 1 }, ...fields });

test("matched manual-review DRAFT is not final even though recognition is terminal", () => {
  assert.equal(omrGradingAttentionCount(batch({ grading_complete: false, grading_status: "pending",
    grading_counts: { completed: 0, subjective_pending: 0, manual_review_required: 0, grading_pending: 1 },
  })), 1);
  assert.equal(omrGradingAttentionCount(batch({ grading_complete: false })), 1);
});
test("known pending counts qualify legacy flags; missing flags alone do not reinterpret history", () => {
  assert.equal(omrGradingAttentionCount(batch({ grading_counts: { manual_review_required: 1 } })), 1);
  assert.equal(omrGradingAttentionCount(batch()), 0);
  assert.equal(omrGradingAttentionCount(), 0);
});
test("finalized, all-failed, processing and pure subjective-pending keep their existing treatment", () => {
  assert.equal(omrGradingAttentionCount(batch({ grading_complete: true })), 0);
  assert.equal(omrGradingAttentionCount(batch({ terminal: false, grading_complete: false })), 0);
  assert.equal(omrGradingAttentionCount(batch({ counts: { completed: 0 }, grading_complete: false })), 0);
  assert.equal(omrGradingAttentionCount(batch({ grading_complete: false, grading_status: "subjective_pending",
    grading_counts: { subjective_pending: 1 },
  })), 0);
});
test("mixed failures do not invent pending grades for already finalized rows", () => {
  assert.equal(omrGradingAttentionCount(batch({ counts: { completed: 2, failed: 1 }, grading_complete: false,
    grading_counts: { completed: 2, subjective_pending: 0, manual_review_required: 0, grading_pending: 0 },
  })), 0);
  assert.equal(omrGradingAttentionCount(batch({ counts: { completed: 2, failed: 1 }, grading_complete: false,
    grading_counts: { completed: 1, subjective_pending: 0, manual_review_required: 1, grading_pending: 0 },
  })), 1);
});
test("manual review is visible alongside a separate subjective input wait", () => {
  assert.equal(omrGradingAttentionCount(batch({ counts: { completed: 2 }, grading_complete: false,
    grading_status: "subjective_pending", grading_counts: { completed: 0, subjective_pending: 1,
      manual_review_required: 1, grading_pending: 0 },
  })), 1);
});
