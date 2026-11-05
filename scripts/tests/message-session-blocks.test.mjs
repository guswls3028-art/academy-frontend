import assert from "node:assert/strict";
import test from "node:test";
import { lintAlimtalkTemplateQuality } from "../../src/app_admin/domains/messages/utils/templateQuality.ts";
import { expandScoreMessageBlocks, scoreMessageItems, missingScoreMessageItems, preserveScoreMessageBlocks } from "../../src/shared/messaging/scoreMessageEditor.ts";

test("empty/deleted content never creates a message, even when scores are available", () => {
  const values = { 시험1명: "단원평가", 과제1명: "오답노트" };
  assert.equal(expandScoreMessageBlocks("", values), "");
  assert.equal(expandScoreMessageBlocks("선생님이 작성한 문장", values), "선생님이 작성한 문장");
});

test("saved aggregate content expands into individually editable rows without copying student scores", () => {
  const values = { 시험2명: "두 번째 시험", 시험1명: "첫 시험", 과제1명: "복습과제", 과제2명: "" };
  const expanded = expandScoreMessageBlocks("안내\n#{시험성적}\n마지막 문장", values);
  assert.match(expanded, /#\{시험1명\}: #\{시험1결과\}\n#\{시험2명\}: #\{시험2결과\}/);
  assert.match(expanded, /#\{과제1명\}: #\{과제1결과\}/);
  assert.ok(expanded.startsWith("안내\n") && expanded.endsWith("\n마지막 문장"));
  assert.ok(!expanded.includes("#{시험성적}") && !expanded.includes("첫 시험"));
  assert.equal(expandScoreMessageBlocks(expanded, values), expanded);
  assert.deepEqual(scoreMessageItems(values).map(item => item.name), ["첫 시험", "두 번째 시험", "복습과제"]);
});

test("individual result variables remain valid when editing a saved template outside a class", () => {
  assert.equal(lintAlimtalkTemplateQuality({ body: "#{과제1명}: #{과제1결과}\n#{시험1결과}", blockCategory: "grades" })
    .some(issue => issue.id === "unknown-vars"), false);
});

test("actual class and homework totals blocks are supported without hardcoded values", () => {
  const issues = lintAlimtalkTemplateQuality({
    body: "#{현재차시명} #{현재차시날짜} / #{다음차시명} #{다음차시날짜} / #{12차시후명} #{12차시후날짜}\n과제 #{과제총점}/#{과제총만점}",
    blockCategory: "grades",
  });
  assert.equal(issues.some(issue => issue.id === "unknown-vars"), false);
});

test("invalid future offsets remain unsupported", () => {
  const issues = lintAlimtalkTemplateQuality({ body: "#{0차시후명} #{100차시후날짜}", blockCategory: "grades" });
  assert.equal(issues.some(issue => issue.id === "unknown-vars"), true);
});

test("fixed saved rows expose omitted results independently of totals", () => {
  const values = { 시험1명: "어휘", 시험2명: "하프모의", 과제1명: "완료 과제" };
  assert.deepEqual(missingScoreMessageItems("#{시험1명}: #{시험1}/#{시험1만점}\n총점 #{시험총점}", values).map(item => item.name), ["하프모의", "완료 과제"]);
  assert.deepEqual(missingScoreMessageItems("#{시험목록}\n#{과제1결과}", values), []);
  assert.deepEqual(missingScoreMessageItems("#{시험성적}", values), []);
  assert.equal(missingScoreMessageItems("#{시험1명} #{시험10}", values).length, 3);
});

test("saving untouched automatic lists preserves future assessments without restoring deleted rows", () => {
  const values = { 시험1명: "어휘", 시험2명: "본문" };
  const source = "직접 쓴 안내\n#{시험목록}\n끝 문장";
  const expanded = expandScoreMessageBlocks(source, values);
  const saved = preserveScoreMessageBlocks(expanded.replace("직접 쓴 안내", "변경한 안내"), source, values);
  assert.equal(saved, source.replace("직접 쓴 안내", "변경한 안내"));
  assert.match(expandScoreMessageBlocks(saved, { ...values, 시험3명: "하프모의" }), /#\{시험3결과\}/);
  const deleted = expanded.replace("\n#{시험2명}: #{시험2결과}", "");
  assert.equal(preserveScoreMessageBlocks(deleted, source, values), deleted);
  assert.equal(preserveScoreMessageBlocks("", source, values), "");
});
