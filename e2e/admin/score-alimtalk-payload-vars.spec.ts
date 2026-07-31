import { expect, test } from "../fixtures/strictTest";

import {
  compactGradesPayloadVars,
  compactGradesPerStudentPayloadVars,
} from "../../src/app_admin/domains/messages/components/scorePayloadVars";

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
