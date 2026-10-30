import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Execute the real browser helper's API assertions against the SessionScores
// contract: passed belongs to each homework; clinic_required belongs to its row.
const source = readFileSync(new URL("../../e2e/helpers/homeworkCriteriaRealuse.ts", import.meta.url), "utf8")
  .replaceAll("\r\n", "\n");
const functionStart = source.indexOf("export async function verifyHomeworkCriteria(");
const start = source.indexOf("      const row = scores.rows.find(", functionStart);
const end = source.indexOf("      await assertNoHorizontalOverflow(page);", start);
assert.ok(functionStart >= 0 && start > functionStart && end > start, "Locate the actual criteria API assertion block");
const check = new Function("expect", "scores", "enrollmentId", "homeworkId", "completionHomeworkId",
  "completionScore", "completionPassed", "passed", "scenario", stripTypeScriptTypes(source.slice(start, end)));
const exactExpect = actual => ({
  toBe: expected => assert.strictEqual(actual, expected),
  toMatchObject: expected => {
    for (const [key, value] of Object.entries(expected)) {
      assert.strictEqual(actual?.[key], value, `Unexpected ${key}`);
    }
  },
});

// Explicit mixed-result fixtures keep the expected row projection independent
// of the formula used by the helper. The 60-point comparison student always fails.
const cases = [
  { width: 1366, threshold: 95, passed: false, completionScore: 1, completionPassed: true, comparisonCompletionScore: 0, comparisonCompletionPassed: false, clinic: true },
  { width: 1366, threshold: 90, passed: true, completionScore: 1, completionPassed: true, comparisonCompletionScore: 0, comparisonCompletionPassed: false, clinic: false },
  { width: 390, threshold: 95, passed: false, completionScore: 0, completionPassed: false, comparisonCompletionScore: 1, comparisonCompletionPassed: true, clinic: true },
  { width: 390, threshold: 90, passed: true, completionScore: 0, completionPassed: false, comparisonCompletionScore: 1, comparisonCompletionPassed: true, clinic: true },
];

for (const current of cases) {
  test(`actual criteria assertions preserve row clinic and item verdicts at ${current.width}px / ${current.threshold}`, () => {
    const scores = { rows: [
      { enrollment_id: 11, clinic_required: current.clinic, homeworks: [
        { homework_id: 31, block: { score: 92, passed: current.passed, clinic_required: current.clinic } },
        { homework_id: 32, block: { score: current.completionScore, passed: current.completionPassed, clinic_required: current.clinic } },
      ] },
      { enrollment_id: 12, clinic_required: true, homeworks: [
        { homework_id: 31, block: { score: 60, passed: false, clinic_required: true } },
        { homework_id: 32, block: { score: current.comparisonCompletionScore, passed: current.comparisonCompletionPassed, clinic_required: true } },
      ] },
    ] };
    const run = value => check(exactExpect, value, 11, 31, 32, current.completionScore,
      current.completionPassed, current.passed,
      { comparisonStudent: { enrollmentId: 12, completionScore: current.comparisonCompletionScore } });
    run(scores);

    // Both row flags and all four individual scores/verdicts/flag projections
    // remain mandatory; correcting scope must not weaken any of these checks.
    for (const rowIndex of [0, 1]) {
      const wrongRow = structuredClone(scores);
      wrongRow.rows[rowIndex].clinic_required = !wrongRow.rows[rowIndex].clinic_required;
      assert.throws(() => run(wrongRow), assert.AssertionError, `row ${rowIndex} aggregate clinic flag`);
      for (const homeworkIndex of [0, 1]) {
        for (const field of ["score", "passed", "clinic_required"]) {
          const wrongBlock = structuredClone(scores);
          const block = wrongBlock.rows[rowIndex].homeworks[homeworkIndex].block;
          block[field] = field === "score" ? block[field] + 1 : !block[field];
          assert.throws(() => run(wrongBlock), assert.AssertionError,
            `row ${rowIndex} homework ${homeworkIndex} ${field}`);
        }
      }
    }
  });
}
