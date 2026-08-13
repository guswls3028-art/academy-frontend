import assert from "node:assert/strict";
import test from "node:test";

import { buildDuplicateTemplateName } from "../../src/app_admin/domains/messages/utils/templateCopyName.ts";

test("plain template receives one copy prefix", () => {
  assert.equal(buildDuplicateTemplateName("학부모 안내"), "복사 - 학부모 안내");
});

test("recursive copy prefixes collapse to one", () => {
  assert.equal(
    buildDuplicateTemplateName("복사 - 복사-  복사 - 학부모 안내"),
    "복사 - 학부모 안내",
  );
});

test("prefix-only and long names remain usable and within the API limit", () => {
  assert.equal(buildDuplicateTemplateName("복사 - 복사 - "), "복사 - 새 문구");
  const result = buildDuplicateTemplateName("가".repeat(200));
  assert.equal([...result].length, 120);
  assert.ok(result.startsWith("복사 - "));
});
