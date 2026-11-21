import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRoster, updateRosterSelection } from "../src/shared/product/dawon/adminRosterSelection.ts";

const rows = Array.from({ length: 207 }, (_, i) => ({
  id: i + 1, name: `학생 ${i + 1}`, school: i % 2 ? "가람고" : "다원중", grade: i % 3 + 1,
  phone: i === 120 ? "010-8654-1397" : "", parent_phone: i === 162 ? "010-3467-1219" : "",
}));

test("local search covers the full roster before paging and intersects phone, name, school and grade", () => {
  for (const term of ["1397", "8654-1397", "０１０８６５４１３９７"]) {
    assert.deepEqual(filterRoster(rows, term, "1").map(s => s.id), [121]);
    assert.deepEqual(filterRoster(rows, term, "2"), []);
  }
  assert.deepEqual(filterRoster(rows, "1219", "").map(s => s.id), [163]);
  assert.deepEqual(filterRoster(rows, "학생 201", "").map(s => s.id), [201]);
  assert.equal(filterRoster(rows, "가람고", "1").every(s => s.school === "가람고" && s.grade === 1), true);
});

test("selection persists across pages, deduplicates Excel matches and rejects oversized additions atomically", () => {
  let chosen = new Map();
  for (let page = 0; page < 4; page++) chosen = updateRosterSelection(chosen, rows.slice(page*50,page*50+50), false);
  assert.equal(chosen.size, 200);
  assert.equal(updateRosterSelection(chosen, rows.slice(195), false), null);
  assert.equal(updateRosterSelection(chosen, rows.slice(0,10), false).size, 200);
  const reduced = updateRosterSelection(chosen, rows.slice(50,100), true);
  assert.equal(reduced.size, 150);
  assert.ok(reduced.has(1) && reduced.has(200) && !reduced.has(51));
  assert.equal(chosen.size, 200);
});
