import assert from "node:assert/strict";
import test from "node:test";
import { lintAlimtalkTemplateQuality } from "../../src/app_admin/domains/messages/utils/templateQuality.ts";

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
