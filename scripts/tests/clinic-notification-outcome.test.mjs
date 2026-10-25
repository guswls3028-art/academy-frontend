import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = stripTypeScriptTypes(readFileSync(new URL(
  "../../src/app_teacher/domains/clinic/notificationOutcome.ts", import.meta.url,
), "utf8"));
const { buildClinicOutcomeNotice } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("clinic receipt keeps accepted and failed counts separate", () => {
  const notice = buildClinicOutcomeNotice("등원", { requested: 1, failed: 1, send_to: "both" });
  assert.equal(notice.tone, "error");
  assert.match(notice.message, /1건 접수, 1건 실패/);
  assert.match(notice.message, /처리는 완료/);
  assert.match(notice.message, /발송 내역/);
});

test("zero receipts are informational and accepted receipts do not claim delivery", () => {
  assert.equal(buildClinicOutcomeNotice("하원", { requested: 0, failed: 0, send_to: "parent" }).tone, "info");
  const notice = buildClinicOutcomeNotice("재촉", { requested: 2, failed: 0, send_to: "student" });
  assert.equal(notice.tone, "success");
  assert.match(notice.message, /2건 접수/);
  assert.match(notice.message, /실제 전달 결과는 발송 내역/);
  assert.equal(buildClinicOutcomeNotice("완료", null).message, "완료 처리가 완료되었습니다.");
});
