import { expect, test } from "../fixtures/strictTest";

import {
  compactGradesPayloadVars,
  compactGradesPerStudentPayloadVars,
} from "../../src/app_admin/domains/messages/components/scorePayloadVars";
import {
  buildScoreDetail,
  buildScoreVars,
  collectUnenteredScoreItems,
  generateScoreReport,
  scoreMessageStudentVars,
  substituteScoreVars,
} from "../../src/shared/scoring/scoreReport";
import { buildAnonymousBillboardDocument } from "../../src/app_admin/domains/scores/utils/anonymousBillboardPdfGenerator";
import { getClinicStats } from "../../src/app_admin/domains/scores/utils/clinicPdfGenerator";
import { buildScorePdfHtml } from "../../src/app_admin/domains/scores/utils/scorePdfGenerator";
import { expandScoreMessageBlocks } from "../../src/shared/messaging/scoreMessageEditor";
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

test("편집 가능한 개별 과제 행은 학생별 통과/미통과와 미입력을 구분하고 삭제한 행을 보내지 않는다", () => {
  const meta = { ...scoreMeta, homeworks: [{ ...scoreMeta.homeworks![0], grading_mode: "COMPLETION" as const, max_score: 1 }] };
  const first = scoreRow(null);
  first.homeworks[0].block.score = 1;
  const second = scoreRow(null);
  second.homeworks[0].block.score = 0;
  const body = expandScoreMessageBlocks("과제 안내\n#{과제목록}", buildScoreVars(first, meta));
  expect(body).toBe("과제 안내\n#{과제1명}: #{과제1결과}");
  expect(substituteScoreVars(body, first, meta)).toBe("과제 안내\n연습과제: 통과");
  expect(substituteScoreVars(body, second, meta)).toBe("과제 안내\n연습과제: 미통과");
  expect(substituteScoreVars(body, scoreRow(null), meta)).toContain("미입력");
  expect(substituteScoreVars("직접 고친 문장", first, meta)).toBe("직접 고친 문장");
  expect(substituteScoreVars("", first, meta)).toBe("");
});

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
for (const score of [0, 90]) {
  test(`미확정 시험 ${score}점은 성적 알림톡의 점수·평균·합격으로 확정하지 않는다`, () => {
    const row = scoreRow(null);
    row.homeworks = [];
    row.exams[0].block = {
      ...row.exams[0].block, score, passed: score >= 70, is_provisional: true,
    };
    row.exam_total = { score: null, max_score: 100, selected_count: 1, scored_count: 0, complete: false };
    const vars = buildScoreVars(row, scoreMeta);
    const detail = buildScoreDetail(row, scoreMeta);
    expect(collectUnenteredScoreItems(row)).toEqual(["시험: 단원평가"]);
    expect(vars["시험1"]).toBe("채점 확인 중");
    expect(vars["시험목록"]).toContain("채점 확인 중");
    expect(vars["시험성적"]).toContain("채점 확인 중");
    expect(detail).toContain("채점 확인 중");
    expect(detail).not.toContain(`${score}/100`);
    expect(vars["전체요약"]).not.toContain("평균");
    expect(vars["전체요약"]).not.toContain("최종: 합격");
    expect(vars["전체요약"]).toContain("점수 확인 필요");
    expect(vars["시험총점"]).toBe("집계 중 (0/1)");
    row.exams[0].block.is_provisional = false;
    expect(collectUnenteredScoreItems(row)).toEqual([]);
    expect(buildScoreVars(row, scoreMeta)["시험1"]).toBe(String(score));
  });
}

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
  row.exam_total = { score: null, max_score: 100, selected_count: 1, scored_count: 0, complete: false };
  row.homework_total = { score: 10, max_score: 10, selected_count: 1, scored_count: 1, complete: true };

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
  expect(vars["시험총점"]).toBe("집계 중 (0/1)");
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


test("@assessment-feedback 학생별 본문은 발송일과 실제 차시 블록을 서버까지 보존한다", () => {
  const body = "발송 #{날짜} #{시간} / 수업 #{현재차시날짜} / #{다음차시명} #{12차시후날짜}";
  const substituted = substituteScoreVars(body, scoreRow(null), scoreMeta, { date: "2001-01-01" });
  expect(substituted).toBe(body);
  const compact = compactGradesPerStudentPayloadVars(body, { 101: { _body_subst: substituted, 날짜: "2001-01-01" } });
  expect(compact?.[101]).toEqual({ _body_subst: body });
});


test("@assessment-feedback 합산 총점 변수는 서버 선택·진짜 0점·미입력을 구분한다", () => {
  const row = scoreRow(null);
  row.exams[0].block.score = 0;
  row.homeworks[0].block.score = 0;
  row.exam_total = { score: 0, max_score: 100, selected_count: 1, scored_count: 1, complete: true };
  row.homework_total = { score: 0, max_score: 10, selected_count: 1, scored_count: 1, complete: true };
  let vars = buildScoreVars(row, scoreMeta);
  expect(vars["시험총점"]).toBe("0");
  expect(vars["시험총만점"]).toBe("100");
  expect(vars["과제총점"]).toBe("0");
  expect(vars["과제총만점"]).toBe("10");
  row.exam_total = { score: null, max_score: 100, selected_count: 1, scored_count: 0, complete: false };
  row.homework_total = { score: null, max_score: 10, selected_count: 1, scored_count: 0, complete: false };
  vars = buildScoreVars(row, scoreMeta);
  expect(vars["시험총점"]).toBe("집계 중 (0/1)");
  expect(vars["과제총점"]).toBe("집계 중 (0/1)");
  row.exam_total = { score: null, max_score: 0, selected_count: 0, scored_count: 0, complete: false };
  row.homework_total = undefined;
  vars = buildScoreVars(row, scoreMeta);
  expect(vars["시험총점"]).toBe("합산 대상 없음");
  expect(vars["시험총만점"]).toBe("-");
  expect(vars["과제총점"]).toBe("집계 정보 없음");
});

test("@assessment-feedback 선택 시험만 PDF 분모·평균에 포함하고 0점은 참여자로 유지한다", () => {
  const meta: SessionScoreMeta = { ...scoreMeta,
    total_config: { version: 1, exam_ids: [11], homework_ids: [21] },
    exams: [...scoreMeta.exams, { exam_id: 12, title: "합산 제외 평가", pass_score: 100, max_score: 500, display_order: 2 }],
  };
  const row = scoreRow(null);
  row.exams[0].block.score = 80;
  row.exams.push({ exam_id: 12, title: "합산 제외 평가", pass_score: 100, block: { score: 499, max_score: 500, passed: true, clinic_required: false, meta: {} } });
  row.exam_total = { score: 80, max_score: 100, selected_count: 1, scored_count: 1, complete: true };
  row.homework_total = { score: 7, max_score: 10, selected_count: 1, scored_count: 1, complete: true };
  const vars = buildScoreVars(row, meta);
  expect(vars["시험총점"]).toBe("80"); expect(vars["시험총만점"]).toBe("100");
  expect(vars["과제총점"]).toBe("7"); expect(vars["과제총만점"]).toBe("10");
  const zero = { ...row, enrollment_id: 2, student_id: 102,
    exam_total: { score: 0, max_score: 100, selected_count: 1, scored_count: 1, complete: true } };
  const pending = { ...row, enrollment_id: 3, student_id: 103,
    exam_total: { score: null, max_score: 100, selected_count: 1, scored_count: 0, complete: false } };
  const pdf = buildAnonymousBillboardDocument({ rows: [row, zero, pending], meta, sessionTitle: "1차시", lectureTitle: "수학" });
  expect(pdf.examTitles).toEqual(["단원평가"]);
  expect(pdf.totalMaxScore).toBe(100);
  expect(pdf.participantCount).toBe(2);
  expect(pdf.averageScore).toBe(40);
  expect(pdf.rows.map(item => item.score)).toEqual([80, 0]);
  expect(pdf.rows.every(item => item.maxScore === 100)).toBe(true);
});

test("@assessment-feedback 소수 만점 합계의 부동소수 오차로 익명 순위표 참여자를 누락하지 않는다", () => {
  const meta: SessionScoreMeta = {
    ...scoreMeta,
    total_config: { version: 1, exam_ids: [11, 12], homework_ids: [] },
    exams: [
      { exam_id: 11, title: "소수 배점 A", pass_score: 1, max_score: 1.1, display_order: 1 },
      { exam_id: 12, title: "소수 배점 B", pass_score: 1, max_score: 2.2, display_order: 2 },
    ],
  };
  const row = scoreRow(null);
  row.exam_total = { score: 3.1, max_score: 3.3, selected_count: 2, scored_count: 2, complete: true };
  const zero = { ...row, enrollment_id: 2, exam_total: { ...row.exam_total, score: 0 } };
  const differentMaximum = { ...row, enrollment_id: 3, exam_total: { ...row.exam_total, max_score: 3.31 } };
  const unassigned = { ...row, enrollment_id: 4, exam_total: { ...row.exam_total, selected_count: 1, scored_count: 1, max_score: 1.1 } };
  const pending = { ...row, enrollment_id: 5, exam_total: { ...row.exam_total, complete: false, scored_count: 1 } };
  const pdf = buildAnonymousBillboardDocument({
    rows: [row, zero, differentMaximum, unassigned, pending], meta,
    sessionTitle: "1차시", lectureTitle: "소수 배점",
  });
  expect(pdf.participantCount).toBe(2);
  expect(pdf.rows.map(item => item.score)).toEqual([3.1, 0]);
  expect(pdf.totalMaxScore).toBeCloseTo(3.3, 12);
  expect(pdf.averageScore).toBeCloseTo(1.55, 12);
});

test("@alimtalk-order 번호형 결과는 순서 변경·학생별 미배정에도 같은 평가를 유지한다", () => {
  const meta: SessionScoreMeta = { ...scoreMeta,
    total_config: { version: 2, exam_ids: [11], homework_ids: [21], exam_order: [12, 11] },
    exams: [{ ...scoreMeta.exams[0], exam_id: 12, title: "합산 제외 시험", display_order: 0 }, scoreMeta.exams[0]],
    homeworks: [{ ...scoreMeta.homeworks[0], homework_id: 22, title: "추가 과제", display_order: 0 }, scoreMeta.homeworks[0]],
  };
  const first = scoreRow(null);
  first.exams[0].block.score = 80;
  first.exams.push({ ...first.exams[0], exam_id: 12, title: "합산 제외 시험", block: { ...first.exams[0].block, score: 25 } });
  first.homeworks[0].block.score = 7;
  first.exam_total = { score: 80, max_score: 100, selected_count: 1, scored_count: 1, complete: true };
  const vars = buildScoreVars(first, meta);
  expect(vars).toMatchObject({ 시험1명: "합산 제외 시험", 시험1: "25", 시험2명: "단원평가", 시험2: "80", 시험총점: "80", 과제1명: "추가 과제", 과제1결과: "미배정", 과제2: "7" });
  const body = "#{시험1명}: #{시험1결과}\n#{시험2명}: #{시험2결과}\n총점 #{시험총점}/#{시험총만점}";
  const second = scoreRow(null);
  second.exams[0].block.score = 0;
  second.exam_total = { score: 0, max_score: 100, selected_count: 1, scored_count: 1, complete: true };
  const rendered = substituteScoreVars(body, second, meta);
  expect(rendered).toContain("합산 제외 시험: 미배정");
  expect(rendered).toContain("단원평가: 0/100");
  expect(rendered).toContain("총점 0/100");
  expect(compactGradesPerStudentPayloadVars(body, { 101: { _body_subst: rendered } })?.[101]).toEqual({ _body_subst: rendered });
});

test("@alimtalk-order 전체 성적 블록과 목록은 차시 순서를 사용하고 학생별 미배정은 목록에서 생략한다", () => {
  const meta: SessionScoreMeta = {
    exams: [{ ...scoreMeta.exams[0], exam_id: 12, title: "먼저 보는 시험" }, scoreMeta.exams[0]],
    homeworks: [{ ...scoreMeta.homeworks[0], homework_id: 22, title: "먼저 보는 과제" }, scoreMeta.homeworks[0]],
  };
  const row = scoreRow(null);
  row.exams.push({ ...row.exams[0], exam_id: 12, title: "먼저 보는 시험" });
  row.homeworks.push({ ...row.homeworks[0], homework_id: 22, title: "먼저 보는 과제" });
  const vars = buildScoreVars(row, meta);
  expect(vars["시험목록"]).toMatch(/먼저 보는 시험[\s\S]*단원평가/);
  expect(vars["시험이력"]).toBe(vars["시험목록"]);
  expect(vars["과제목록"]).toMatch(/먼저 보는 과제[\s\S]*연습과제/);
  expect(vars["전체요약"]).toContain("미입력 항목: 먼저 보는 시험, 단원평가, 먼저 보는 과제, 연습과제");
  expect(vars["시험성적"]).toMatch(/먼저 보는 시험[\s\S]*단원평가[\s\S]*먼저 보는 과제[\s\S]*연습과제/);
  expect(vars["선생님메모"]).toBe(vars["시험성적"]);
  expect(buildScoreDetail(row, meta)).toBe(vars["시험성적"]);
  expect(row.exams.map(exam => exam.exam_id)).toEqual([11, 12]);
  expect(row.homeworks.map(hw => hw.homework_id)).toEqual([21, 22]);

  const [practice, firstHomework] = row.homeworks;
  const videoRow: SessionScoreRow = {
    ...row,
    attendance_status: "ONLINE",
    homeworks: [
      { ...practice, block: { ...practice.block, meta: { ...practice.block.meta, status: "NOT_SUBMITTED" } } },
      firstHomework,
    ],
  };
  const videoOptions = { showVideoHomeworkLabel: true };
  const videoVars = buildScoreVars(videoRow, meta, videoOptions);
  expect(videoVars).toMatchObject({ 과제1결과: "점수 미입력", 과제2결과: "영상보강" });
  expect(videoVars["과제목록"]).toMatch(/먼저 보는 과제: 점수 미입력[\s\S]*연습과제: 영상보강/);
  expect(videoVars["시험성적"]).toMatch(/┌ 먼저 보는 과제\n└ 점수 미입력[\s\S]*┌ 연습과제\n└ 영상보강/);
  expect(buildScoreDetail(videoRow, meta, videoOptions)).toBe(videoVars["시험성적"]);
  expect(buildScoreVars(videoRow, meta)["과제2결과"]).toBe("미제출");

  const sparse = buildScoreVars(scoreRow(null), meta);
  expect(sparse["시험1결과"]).toBe("미배정");
  expect(sparse["과제1결과"]).toBe("미배정");
  expect(sparse["시험목록"]).not.toContain("먼저 보는 시험");
  expect(sparse["과제목록"]).not.toContain("먼저 보는 과제");
});

for (const gradingMode of ["SCORE", "COMPLETION"] as const) {
  for (const score of [null, 0]) {
    test(`교사 접수는 이전 미제출을 대체하고 원점수를 유지한다 (${gradingMode}, ${score})`, () => {
      const row = scoreRow("NOT_SUBMITTED");
      row.exams = [];
      row.attendance_status = "ONLINE";
      const hw = row.homeworks[0];
      hw.block = { ...hw.block, score, passed: true, teacher_accepted: true };
      const meta = { ...scoreMeta, homeworks: [{ ...scoreMeta.homeworks[0], grading_mode: gradingMode }] };
      const options = { showVideoHomeworkLabel: true };
      const vars = buildScoreVars(row, meta, options);
      const result = score === 0 && gradingMode === "SCORE" ? "0/10 (0%) 통과 (교사 확인)" : "통과 (교사 확인)";
      expect(vars["과제1결과"]).toBe(result);
      expect(vars["과제1"]).toBe(score === 0 && gradingMode === "SCORE" ? "0" : result);
      expect(vars["과제목록"]).toContain(result);
      expect(vars["시험성적"]).toContain(result);
      expect(generateScoreReport(row, meta, options)).toContain(result);
      expect(vars["숙제완성도"]).toBe("1/1 완료");
      expect(vars["전체요약"]).toContain("최종: 합격");
      expect(substituteScoreVars("#{과제1명}: #{과제1결과}", row, meta, options)).toBe(`연습과제: ${result}`);
      expect(collectUnenteredScoreItems(row)).toEqual([]);

      row.homeworks.push({ ...hw, homework_id: 22, title: "다른 과제",
        block: { ...hw.block, score: null, passed: false, teacher_accepted: false } });
      expect(buildScoreVars(row, meta)["과제2결과"]).toBe("미제출");
      hw.block.meta = { status: null };
      row.homeworks[1].block.meta = { status: null };
      expect(collectUnenteredScoreItems(row)).toEqual(["과제: 다른 과제"]);
    });
  }
}

test("성적 문구가 실제 참조한 학생별 과제 슬롯의 판정만 전송한다", () => {
  const row = scoreRow("NOT_SUBMITTED");
  const hw = row.homeworks[0];
  row.homeworks = [
    { ...hw, homework_id: 24, block: { ...hw.block, score: 0 } },
    { ...hw, homework_id: 23, block: { ...hw.block, teacher_accepted: true } },
    hw,
  ];
  const meta = { ...scoreMeta, homeworks: [21, 22, 23, 24].map(homework_id => ({ ...scoreMeta.homeworks[0], homework_id })) };
  const values = buildScoreVars(row, meta);
  const compact = (body: string) => compactGradesPerStudentPayloadVars(body, { 101: scoreMessageStudentVars(body, row, meta, values) })![101];
  const expected = [[1, 21, "missing"], [3, 23, "accepted"], [4, 24, "other"]];
  for (const key of ["과제목록", "시험성적", "선생님메모", "전체요약", "숙제완성도"]) {
    expect(JSON.parse(compact(`#{${key}}`)._homework_notice_states)).toEqual(expected);
  }
  expect(JSON.parse(compact("#{과제4결과} #{과제1} #{과제4}")._homework_notice_states)).toEqual([expected[0], expected[2]]);
  for (const body of ["안녕하세요", "#{과제2결과}", "#{과제1명} #{과제1만점} #{과제1최고점} #{시험목록}"]) {
    expect(compact(body)).not.toHaveProperty("_homework_notice_states");
  }
  const alternate = scoreRow(null);
  const body = "#{과제1결과}";
  const multiple = compactGradesPerStudentPayloadVars(body, {
    101: scoreMessageStudentVars(body, row, meta, values),
    102: scoreMessageStudentVars(body, alternate, meta, buildScoreVars(alternate, meta)),
  })!;
  expect(JSON.parse(multiple[101]._homework_notice_states)).toEqual([expected[0]]);
  expect(JSON.parse(multiple[102]._homework_notice_states)).toEqual([[1, 21, "other"]]);
  expect(multiple[101]._body_subst).toBe("미제출");
});
