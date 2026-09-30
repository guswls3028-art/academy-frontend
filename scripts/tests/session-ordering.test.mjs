import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSessionLabel,
  formatSessionOrderLabel,
  getNextRegularOrder,
  getRegularOrder,
  getSessionType,
  sortSessionsByDisplayOrder,
} from "../../src/shared/product/sessions/sessionOrdering.ts";

test("a named regular lesson keeps its type and regular sequence", () => {
  const session = {
    id: 7, order: 9, regular_order: 7, session_type: "REGULAR",
    title: " 직보(직전보강) ", display_label: "7차시",
  };
  assert.equal(formatSessionLabel(session), "직보(직전보강)");
  assert.equal(formatSessionOrderLabel(9, session.title, "REGULAR", 7), "직보(직전보강)");
  assert.equal(getSessionType(session), "REGULAR");
  assert.equal(getRegularOrder(session), 7);
  assert.equal(getNextRegularOrder([session]), 8);
});

test("the API custom display label is used when supplied", () => {
  assert.equal(formatSessionLabel({
    session_type: "REGULAR", regular_order: 7,
    title: "", display_label: "직보(직전보강)",
  }), "직보(직전보강)");
});

test("empty and generated numbered titles follow regular_order after renumbering", () => {
  for (const title of ["", "  ", "1", "1차시", "1차시 (14:00~16:00)", "1차시 (14:00-16:00)"]) {
    assert.equal(formatSessionLabel({
      title, display_label: "1차시", order: 3, regular_order: 7, session_type: "REGULAR",
    }), "7차시", title);
  }
});

test("descriptive parentheses and the word 차시 in a name are preserved", () => {
  for (const title of ["직보(직전보강)", "7차시 (심화)", "다음 차시 대비", "직보 (14:00~16:00)"]) {
    assert.equal(formatSessionLabel({ title, regular_order: 7, session_type: "REGULAR" }), title);
  }
});

test("supplement labels and ordering remain independent of regular lessons", () => {
  const supplement = { title: "토요일 심화", order: 8, regular_order: null, session_type: "SUPPLEMENT" };
  assert.equal(formatSessionLabel(supplement), "토요일 심화");
  assert.equal(getSessionType(supplement), "SUPPLEMENT");
  assert.equal(getRegularOrder(supplement), null);
  assert.equal(getNextRegularOrder([supplement, { regular_order: 7, session_type: "REGULAR" }]), 8);
  assert.equal(formatSessionLabel({ title: "", session_type: "SUPPLEMENT" }), "보강");
});

test("naming does not reorder or mutate the session list", () => {
  const regular = { id: 7, order: 2, regular_order: 7, session_type: "REGULAR", title: "직보" };
  const supplement = { id: 8, order: 1, session_type: "SUPPLEMENT", title: "토요 보강" };
  const input = [regular, supplement];
  assert.deepEqual(sortSessionsByDisplayOrder(input), [supplement, regular]);
  assert.deepEqual(input, [regular, supplement]);
});

test("legacy order-only and title-only responses retain numbered fallbacks", () => {
  assert.equal(formatSessionLabel({ order: 7 }), "7차시");
  assert.equal(formatSessionLabel({ title: "7" }), "7차시");
  assert.equal(formatSessionLabel({ display_label: "7" }), "7차시");
  assert.equal(formatSessionLabel({ order: 1, display_label: "1회차", title: "8월 진단평가" }), "8월 진단평가");
  assert.equal(formatSessionLabel(undefined), "-차시");
});
