import { expect, test } from "../fixtures/strictTest";

import {
  compactGradesPayloadVars,
  compactGradesPerStudentPayloadVars,
} from "../../src/app_admin/domains/messages/components/scorePayloadVars";
import {
  buildScoreDetail,
  buildScoreVars,
  collectUnenteredScoreItems,
  substituteScoreVars,
} from "../../src/shared/scoring/scoreReport";
import { buildAnonymousBillboardDocument } from "../../src/app_admin/domains/scores/utils/anonymousBillboardPdfGenerator";
import { getClinicStats } from "../../src/app_admin/domains/scores/utils/clinicPdfGenerator";
import { buildScorePdfHtml } from "../../src/app_admin/domains/scores/utils/scorePdfGenerator";
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

test("점수가 입력된 합격·불합격 과제도 교사 미완료이면 완료 수에 포함하지 않는다", () => {
  const row = scoreRow(null);
  row.exams = [];
  row.homeworks = [80, 70, 80].map((score, index) => ({
    homework_id: index + 1,
    title: `과제 ${index + 1}`,
    block: {
      score,
      max_score: 100,
      passed: score >= 80,
      clinic_required: score < 80,
      correction_status: "PENDING",
      teacher_resolved: false,
    },
  }));

  const vars = buildScoreVars(row, null);
  expect(vars["숙제완성도"]).toBe("0/3 완료");
  expect(vars["전체요약"]).toContain("과제: 0/3 완료");
  const body = substituteScoreVars("숙제완성도: #{숙제완성도}\n#{전체요약}", row, null);
  const payload = compactGradesPerStudentPayloadVars("#{숙제완성도}", {
    [row.student_id]: { _body_subst: body },
  });
  expect(payload?.[row.student_id]?._body_subst).toContain("숙제완성도: 0/3 완료");
  expect(body).not.toContain("3/3 완료");
});

test("과제 완료 수는 교사 완료와 자동 완료만 포함하고 재개방·미확정 상태를 보존한다", () => {
  const row = scoreRow(null);
  row.exams = [];
  row.homeworks = ["COMPLETED", "NOT_REQUIRED", "PENDING", null, undefined].map((status, index) => ({
    homework_id: index + 1,
    title: `과제 ${index + 1}`,
    block: {
      // 교사 완료는 점수와 독립적이며, 100점도 명시 미완료이면 완료가 아니다.
      score: index === 0 ? null : 100,
      max_score: 100,
      passed: index !== 0,
      clinic_required: false,
      correction_status: status as "COMPLETED" | "NOT_REQUIRED" | "PENDING" | null | undefined,
    },
  }));
  expect(buildScoreVars(row, null)["숙제완성도"]).toBe("2/5 완료");
  expect(buildScoreVars(row, null)["전체요약"]).toContain("과제: 2/5 완료");

  row.homeworks[0].block.correction_status = "PENDING";
  expect(buildScoreVars(row, null)["숙제완성도"]).toBe("1/5 완료");
  row.homeworks[0].block.score = 100;
  row.homeworks[0].block.passed = true;
  expect(buildScoreVars(row, null)["숙제완성도"]).toBe("1/5 완료");
});

test("과제 미입력·미제출·과제 없음은 완료로 추정하지 않는다", () => {
  for (const status of [null, "NOT_SUBMITTED"]) {
    const row = scoreRow(status);
    expect(buildScoreVars(row, scoreMeta)["숙제완성도"]).toBe("0/1 완료");
    expect(buildScoreVars(row, scoreMeta)["전체요약"]).toContain("과제: 0/1 완료");
  }
  const row = scoreRow(null);
  row.homeworks = [];
  expect(buildScoreVars(row, scoreMeta)["숙제완성도"]).toBe("-");
  expect(buildScoreVars(row, scoreMeta)["전체요약"]).not.toContain("과제:");
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
test("서술형 미완료 OMR의 객관식 점수는 발송·출력·순위·클리닉에 노출하지 않는다", () => {
  const row = scoreRow(null);
  row.exams[0].block = {
    ...row.exams[0].block,
    score: 80,
    objective_score: 80,
    subjective_score: null,
    passed: null,
    is_provisional: true,
    grading_status: "subjective_pending",
  };
  row.homeworks[0].block = {
    ...row.homeworks[0].block,
    score: 10,
    passed: true,
  };

  const vars = buildScoreVars(row, scoreMeta);
  const detail = buildScoreDetail(row, scoreMeta);
  const scorePdf = buildScorePdfHtml({
    rows: [row],
    meta: scoreMeta,
    sessionTitle: "1회차",
    lectureTitle: "통합과학",
  });
  const billboard = buildAnonymousBillboardDocument({
    rows: [row],
    meta: scoreMeta,
    sessionTitle: "1회차",
    lectureTitle: "통합과학",
  });
  const clinic = getClinicStats([row], scoreMeta, { [row.enrollment_id]: "PRESENT" });

  expect(collectUnenteredScoreItems(row)).toEqual(["시험: 단원평가"]);
  expect(vars["시험1"]).toBe("서술형 입력 필요");
  expect(vars["시험총점"]).toBe("0");
  expect(detail).toContain("서술형 입력 필요");
  expect(detail).not.toContain("80/100");
  expect(scorePdf).toContain("입력중");
  expect(scorePdf).not.toContain(">80</td>");
  expect(billboard.participantCount).toBe(0);
  expect(billboard.rows).toEqual([]);
  expect(clinic).toEqual({ clinicCount: 0, passedCount: 0, totalPresent: 1 });
});

test("서술형 미완료 시험이 있어도 다른 확정 시험의 클리닉 대상은 유지한다", () => {
  const row = scoreRow(null);
  row.clinic_required = true;
  row.exams[0].block = {
    ...row.exams[0].block,
    score: 80,
    objective_score: 80,
    subjective_score: null,
    passed: null,
    is_provisional: true,
    grading_status: "subjective_pending",
  };
  row.exams.push({
    exam_id: 12,
    title: "확정된 단원평가",
    pass_score: 70,
    clinic_link_id: 9912,
    block: {
      score: 50,
      max_score: 100,
      passed: false,
      clinic_required: true,
      is_provisional: false,
      grading_status: null,
      meta: {},
    },
  });
  const meta: SessionScoreMeta = {
    ...scoreMeta,
    exams: [
      ...scoreMeta.exams,
      {
        exam_id: 12,
        title: "확정된 단원평가",
        pass_score: 70,
        max_score: 100,
        display_order: 2,
      },
    ],
  };

  expect(getClinicStats([row], meta, { [row.enrollment_id]: "PRESENT" })).toEqual({
    clinicCount: 1,
    passedCount: 0,
    totalPresent: 1,
  });
});
