import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import { listenMediaQuery } from "../../src/shared/utils/mediaQueryListener.ts";
import { createRandomUuid } from "../../src/shared/utils/randomUuid.ts";

test("UUID generation uses native crypto when present", (t) => {
  const expected = "01234567-89ab-4cde-8fab-0123456789ab";
  const native = {
    randomUUID() {
      assert.equal(this, native);
      return expected;
    },
    getRandomValues() { assert.fail("native UUID generation already supplies secure entropy"); },
  };
  t.mock.getter(globalThis, "crypto", () => native);
  assert.equal(createRandomUuid(), expected);
});

test("older browsers generate UUID v4 from secure random bytes without randomUUID", (t) => {
  let draws = 0;
  t.mock.getter(globalThis, "crypto", () => ({
    getRandomValues(bytes) {
      draws++;
      assert.equal(bytes.length, 16);
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    },
  }));
  assert.equal(createRandomUuid(), "00010203-0405-4607-8809-0a0b0c0d0e0f");
  assert.equal(draws, 1);
});

test("secure UUID fallback keeps distinct file and mutation identifiers", (t) => {
  t.mock.getter(globalThis, "crypto", () => ({
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  }));
  const ids = new Set(Array.from({ length: 256 }, createRandomUuid));
  assert.equal(ids.size, 256);
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test("missing secure entropy never produces a weaker mutation identifier", (t) => {
  t.mock.getter(globalThis, "crypto", () => ({}));
  assert.throws(createRandomUuid, TypeError);
});

for (const modern of [true, false]) {
  test(`${modern ? "modern" : "legacy Safari"} media-query changes remain subscribed until cleanup`, () => {
    const listeners = new Set();
    let adds = 0;
    let removes = 0;
    const add = (listener) => { adds++; listeners.add(listener); };
    const remove = (listener) => { removes++; listeners.delete(listener); };
    const query = modern ? {
      addEventListener(name, listener) { assert.equal(name, "change"); add(listener); },
      removeEventListener(name, listener) { assert.equal(name, "change"); remove(listener); },
      addListener() { assert.fail("legacy listeners must not be registered twice"); },
    } : { addListener: add, removeListener: remove };
    const matches = [];
    const stop = listenMediaQuery(query, (event) => matches.push(event.matches));
    for (const listener of listeners) listener({ matches: true });
    for (const listener of listeners) listener({ matches: false });
    stop();
    for (const listener of listeners) listener({ matches: true });
    assert.deepEqual(matches, [true, false]);
    assert.equal(adds, 1);
    assert.equal(removes, 1);
    assert.equal(listeners.size, 0);
  });
}
