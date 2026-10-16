import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

async function loadLeadApi() {
  const calls = [];
  const source = readFileSync(new URL("../../src/app_promo/domains/landing/api/promoLead.ts", import.meta.url), "utf8");
  const module = new SourceTextModule(stripTypeScriptTypes(source));
  await module.link((specifier) => {
    assert.equal(specifier, "@/shared/api/axios");
    return new SyntheticModule(["default"], function () {
      this.setExport("default", { post: async (...args) => { calls.push(args); return { id: 1, ok: true }; } });
    });
  });
  await module.evaluate();
  return { api: module.namespace, calls };
}

const question = "가".repeat(1488) + "END-QUESTION";
const input = {
  name: "QA", phone: "01000000000", academyName: "학".repeat(80),
  email: "a".repeat(108) + "@example.com", studentCount: "1".repeat(40),
  message: question, privacyAgreed: true, inquiryType: "기능 문의",
  currentWorkflow: "현".repeat(120),
  interests: ["적중 매치업", "칠판용 PPT", "수강생 관리", "시험/과제", "자동채점·성적 관리", "학생앱 영상", "알림톡 발송", "보강/클리닉"],
  attribution: ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => `${key}=${"u".repeat(120)}`).join(", "),
};

for (const method of ["submitPromoContactLead", "submitPromoDemoLead"]) {
  test(`${method} preserves every valid user field when campaign metadata exceeds the API budget`, async () => {
    const { api, calls } = await loadLeadApi();
    await api[method](input);
    assert.equal(calls.length, 1);
    const [path, payload, config] = calls[0];
    assert.equal(path, "/core/landing/consult/");
    assert.equal(config.skipAuth, true);
    assert.equal(payload.privacy_agreed, true);
    assert.equal(payload.privacy_policy_version, "1.2");
    assert.ok(payload.message.length <= 2000);
    for (const value of [question, input.academyName, input.email, input.studentCount]) assert.ok(payload.message.includes(value));
    if (method === "submitPromoDemoLead") {
      assert.ok(payload.message.includes(input.currentWorkflow));
      assert.ok(payload.message.includes(input.interests.join(", ")));
    }
    assert.ok(!payload.message.includes("유입 정보:"));
  });

  test(`${method} keeps short attribution and refuses missing consent or oversized user content before POST`, async () => {
    const { api, calls } = await loadLeadApi();
    await api[method]({ ...input, message: "질문", attribution: "utm_source=guide" });
    assert.ok(calls[0][1].message.includes("유입 정보: utm_source=guide"));
    assert.throws(() => api[method]({ ...input, privacyAgreed: false }), /동의가 필요/);
    assert.throws(() => api[method]({ ...input, message: "가".repeat(2001) }), /너무 깁니다/);
    assert.equal(calls.length, 1);
  });
}

test("unexpected error detail shapes remain readable and never become React children", async () => {
  const { api } = await loadLeadApi();
  assert.equal(api.getPromoLeadErrorMessage({ response: { data: { detail: [{ field: "phone" }, "다시 확인해주세요"] } } }), "다시 확인해주세요");
  assert.equal(typeof api.getPromoLeadErrorMessage({ response: { data: { detail: [{}] } } }), "string");
  assert.equal(api.getPromoLeadErrorMessage({ response: { data: { detail: "잠시 후 다시 시도해주세요" } } }), "잠시 후 다시 시도해주세요");
});
