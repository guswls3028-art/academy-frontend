import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExamStats,
  calculateHomeworkStats,
  calculateWeakestLecture,
  getExamPassStatus,
  gradeLectureKey,
} from "../../src/app_student/domains/grades/utils/gradeStats.ts";

const exam = (overrides = {}) => ({
  exam_id: 1, enrollment_id: 1, title: "시험", total_score: null, max_score: 100,
  is_pass: null, session_title: null, lecture_title: "수학", submitted_at: null,
  ...overrides,
});
const homework = (overrides = {}) => ({
  homework_id: 1, enrollment_id: 1, title: "과제", score: null, max_score: 100,
  passed: null, session_title: null, lecture_title: "수학", ...overrides,
});

test("teacher completion without a score counts as completed, not as a numeric zero", () => {
  assert.deepEqual(calculateHomeworkStats([homework({ teacher_resolved: true })]), {
    passed: 1, failed: 0, graded: 1, total: 1, avgPct: null, passRate: 100,
  });
});

test("teacher-completed unscored homework does not dilute scored homework averages", () => {
  const stats = calculateHomeworkStats([
    homework({ teacher_resolved: true, achievement: "FAIL", passed: false }),
    homework({ homework_id: 2, score: 80, passed: true }),
  ]);
  assert.equal(stats.avgPct, 80);
  assert.equal(stats.passed, 2);
  assert.equal(stats.passRate, 100);
});

test("homework preserves scored zero and an explicit failure", () => {
  assert.deepEqual(calculateHomeworkStats([homework({ score: 0, passed: false, achievement: "FAIL" })]), {
    passed: 0, failed: 1, graded: 1, total: 1, avgPct: 0, passRate: 0,
  });
});

test("unscored and unjudged homework has no average, failure or pass rate", () => {
  assert.deepEqual(calculateHomeworkStats([homework()]), {
    passed: 0, failed: 0, graded: 0, total: 1, avgPct: null, passRate: null,
  });
  const scored = calculateHomeworkStats([homework({ score: 0 })]);
  assert.equal(scored.avgPct, 0);
  assert.equal(scored.failed, 0);
  assert.equal(scored.passRate, null);
});

test("missing or nonpositive maxima do not become zero-percent homework", () => {
  const stats = calculateHomeworkStats([
    homework({ score: 0, max_score: 0 }),
    homework({ score: 0, max_score: null }),
    homework({ score: 30, max_score: 50, passed: true }),
  ]);
  assert.equal(stats.avgPct, 60);
  assert.equal(stats.passRate, 100);
});

test("all unsubmitted exams retain unknown metrics in both display modes", () => {
  for (const wrongCompletionOnly of [false, true]) {
    assert.deepEqual(calculateExamStats([exam({ achievement: "NOT_SUBMITTED", meta_status: "NOT_SUBMITTED" })], wrongCompletionOnly), {
      avgPct: null, passRate: null, count: 1, avgRank: null,
    });
  }
});

test("a scored zero and failed judgment remain numeric zero metrics", () => {
  const stats = calculateExamStats([exam({ total_score: 0, is_pass: false, achievement: "FAIL" })], false);
  assert.equal(stats.avgPct, 0);
  assert.equal(stats.passRate, 0);
});

test("score and pass judgment have independent denominators", () => {
  const stats = calculateExamStats([
    exam({ total_score: 0 }),
    exam({ total_score: 80, is_pass: true }),
    exam({ teacher_resolved: true, achievement: "REMEDIATED" }),
  ], false);
  assert.equal(stats.avgPct, 40);
  assert.equal(stats.passRate, 100);
  assert.equal(stats.count, 3);
  assert.equal(calculateExamStats([exam({ total_score: 30, max_score: 0 })], false).avgPct, null);
});

test("achievement takes precedence and legacy boolean judgments remain supported", () => {
  assert.equal(getExamPassStatus(exam({ achievement: "REMEDIATED", is_pass: false }), false), true);
  assert.equal(getExamPassStatus(exam({ achievement: "FAIL", is_pass: true }), false), false);
  assert.equal(getExamPassStatus(exam({ achievement: "NOT_SUBMITTED", is_pass: false }), false), null);
  assert.equal(getExamPassStatus(exam({ meta_status: "NOT_SUBMITTED", correction_status: "NOT_REQUIRED" }), true), null);
  assert.equal(getExamPassStatus(exam({ is_pass: false }), false), false);
  assert.equal(getExamPassStatus(exam({ is_pass: undefined }), false), null);
});

test("correction mode counts explicit pending and completed states, excluding unknown", () => {
  const exams = [
    exam({ total_score: 20, correction_status: "PENDING", achievement: "PASS" }),
    exam({ total_score: 30, correction_status: "COMPLETED", is_pass: false }),
    exam({ total_score: 100, correction_status: "NOT_REQUIRED" }),
    exam({ total_score: 40, correction_status: null, is_pass: false }),
  ];
  assert.equal(calculateExamStats(exams, true).passRate, 67);
  assert.equal(getExamPassStatus(exams[3], true), null);
});

test("weakest lecture excludes unjudged scores from its pass denominator", () => {
  const exams = [
    exam({ total_score: 10 }),
    exam({ total_score: 20 }),
    exam({ total_score: 60, is_pass: true }),
    exam({ total_score: 90, is_pass: true, lecture_title: "영어", enrollment_id: 2 }),
  ];
  assert.deepEqual(calculateWeakestLecture(exams, false), { name: "수학", avg: 30, passRate: 100 });
});

test("weakest lecture retains low scores with an unknown judgment or a real failure", () => {
  const otherLecture = exam({ total_score: 90, is_pass: true, lecture_title: "영어", enrollment_id: 2 });
  assert.deepEqual(calculateWeakestLecture([exam({ total_score: 0 }), otherLecture], false), {
    name: "수학", avg: 0, passRate: null,
  });
  assert.equal(calculateWeakestLecture([exam({ total_score: 0, is_pass: false }), otherLecture], false).passRate, 0);
  assert.equal(calculateWeakestLecture([exam({ total_score: 0, max_score: 0 }), otherLecture], false), null);
});

test("weakest lecture shares remediated and correction-status judgments with the summary", () => {
  const exams = [
    exam({ total_score: 20, achievement: "REMEDIATED", is_pass: false, correction_status: "COMPLETED" }),
    exam({ total_score: 30, correction_status: null }),
    exam({ total_score: 90, lecture_title: "영어", correction_status: "NOT_REQUIRED", enrollment_id: 2 }),
  ];
  assert.equal(calculateWeakestLecture(exams, false).passRate, 100);
  assert.equal(calculateWeakestLecture(exams, true).passRate, 100);
});

test("empty inputs keep summary sections absent", () => {
  assert.equal(calculateExamStats([], false), null);
  assert.equal(calculateHomeworkStats([]), null);
  assert.equal(calculateWeakestLecture([], false), null);
});

test("same-title lectures keep independent averages and weakness judgments", () => {
  const exams = [
    exam({ lecture_id: 1, total_score: 20, is_pass: false }),
    exam({ lecture_id: 2, enrollment_id: 2, total_score: 100, is_pass: true }),
  ];
  assert.deepEqual(calculateWeakestLecture(exams, false), { name: "수학", avg: 20, passRate: 0 });
  assert.notEqual(gradeLectureKey(exams[0]), gradeLectureKey(exams[1]));
  assert.equal(gradeLectureKey(exams[0]), gradeLectureKey(homework({ lecture_id: 1 })));
});

test("legacy grades use enrollment identity and renamed lecture labels do not split a course", () => {
  assert.notEqual(gradeLectureKey(exam()), gradeLectureKey(exam({ enrollment_id: 2 })));
  const exams = [exam({ lecture_id: 1, total_score: 20 }), exam({ lecture_id: 1, lecture_title: "새 이름", total_score: 40 })];
  assert.equal(calculateWeakestLecture(exams, false), null);
});
