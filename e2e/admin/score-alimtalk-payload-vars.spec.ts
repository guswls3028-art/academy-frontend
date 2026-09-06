import { expect, test } from "../fixtures/strictTest";

import {
  compactGradesPayloadVars,
  compactGradesPerStudentPayloadVars,
} from "../../src/app_admin/domains/messages/components/scorePayloadVars";
import {
  buildScoreDetail,
  buildScoreVars,
  collectUnenteredScoreItems,
} from "../../src/shared/scoring/scoreReport";
import type {
  SessionScoreMeta,
  SessionScoreRow,
} from "../../src/shared/api/contracts/sessionScores";

const scoreMeta: SessionScoreMeta = {
  exams: [{ exam_id: 11, title: "단원평가", pass_score: 70, max_score: 100, display_order: 1 }],
  homeworks: [{ homework_id: 21, title: "연습과제", unit: null, grading_mode: "SCORE", max_score: 10, display_order: 1 }],
};

function scoreRow(status: string | null): SessionScoreRow {
  return {
    enrollment_id: 1,
    student_id: 101,
    student_name: "점검학생",
    updated_at: "2026-08-30T22:00:00+09:00",
    exams: [{
      exam_id: 11,
      title: "단원평가",
      pass_score: 70,
      block: {
        score: null,
        max_score: 100,
        passed: false,
        clinic_required: false,
        meta: { status },
      },
    }],
    homeworks: [{
      homework_id: 21,
      title: "연습과제",
      block: {
        score: null,
        max_score: 10,
        passed: false,
        clinic_required: false,
        meta: { status },
      },
    }],
  };
}

test("성적 알림톡은 본문에 필요한 변수만 보내 서버의 50개 제한을 넘지 않는다", () => {
  const body = "#{학생명} 학생의 #{시험1_이름} 점수는 #{시험1_점수}점입니다.";
  const oversizedVars = Object.fromEntries([
    ["강의명", "수학"],
    ["차시명", "4주차"],
    ["학생명", "점검학생"],
    ...Array.from({ length: 20 }, (_, index) => [
      `시험${index + 1}_이름`,
      `${index + 1}회 시험`,
    ]),
    ...Array.from({ length: 20 }, (_, index) => [
      `시험${index + 1}_점수`,
      String(100 - index),
    ]),
    ...Array.from({ length: 20 }, (_, index) => [
      `시험${index + 1}_등수`,
      String(index + 1),
    ]),
  ]);

  const compact = compactGradesPayloadVars(body, oversizedVars);

  expect(compact).toEqual({
    강의명: "수학",
    차시명: "4주차",
    학생명: "점검학생",
    시험1_이름: "1회 시험",
    시험1_점수: "100",
  });
  expect(Object.keys(compact ?? {})).toHaveLength(5);
});

test("학생별 치환 본문이 있으면 중복 성적 변수 대신 치환 본문만 보낸다", () => {
  const compact = compactGradesPerStudentPayloadVars(
    "#{학생명} 학생의 성적표입니다.",
    {
      2533: {
        _body_subst: "점검학생 학생의 성적표입니다.",
        학생명: "점검학생",
        시험1_점수: "50",
        시험2_점수: "80",
      },
    },
  );

  expect(compact).toEqual({
    2533: { _body_subst: "점검학생 학생의 성적표입니다." },
  });
});

test("학생별 치환 본문이 있으면 공유 payload에는 강의와 차시만 남긴다", () => {
  const compact = compactGradesPayloadVars(
    "#{학생명} 학생의 #{시험1_점수}점 성적표입니다.",
    {
      강의명: "수학",
      차시명: "4주차",
      학생명: "첫 학생",
      시험1_점수: "50",
      시험성적: "첫 학생 50점",
    },
    true,
  );

  expect(compact).toEqual({
    강의명: "수학",
    차시명: "4주차",
  });
});

test("미입력 점수는 미제출·불합격·보충 필요로 변환하지 않는다", () => {
  const row = scoreRow(null);
  const detail = buildScoreDetail(row, scoreMeta);
  const vars = buildScoreVars(row, scoreMeta);

  expect(detail).toContain("점수 미입력");
  expect(detail).toContain("점수 확인 필요");
  expect(detail).not.toContain("미응시");
  expect(detail).not.toContain("미제출");
  expect(detail).not.toContain("불합격");
  expect(detail).not.toContain("보충 필요");
  expect(vars["시험1"]).toBe("점수 미입력");
  expect(vars["과제1"]).toBe("점수 미입력");
  expect(vars["전체요약"]).toContain("점수 확인 필요");
  expect(collectUnenteredScoreItems(row)).toEqual(["시험: 단원평가", "과제: 연습과제"]);
});

test("교사가 명시한 미응시·미제출 상태만 해당 문구로 표시한다", () => {
  const row = scoreRow("NOT_SUBMITTED");
  const detail = buildScoreDetail(row, scoreMeta);
  const vars = buildScoreVars(row, scoreMeta);

  expect(detail).toContain("미응시");
  expect(detail).toContain("미제출");
  expect(vars["시험1"]).toBe("미응시");
  expect(vars["과제1"]).toBe("미제출");
  expect(collectUnenteredScoreItems(row)).toEqual([]);
});
