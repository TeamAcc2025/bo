import assert from "node:assert/strict";
import test from "node:test";
import { addSafeIntegers } from "./fixtures/acceptance-safe-sum.mjs";

test("adds positive, zero and negative safe integers", () => {
  assert.equal(addSafeIntegers(2, 3), 5);
  assert.equal(addSafeIntegers(0, 0), 0);
  assert.equal(addSafeIntegers(-4, 0), -4);
  assert.equal(addSafeIntegers(-4, -3), -7);
  assert.equal(addSafeIntegers(-4, 7), 3);
  assert.equal(addSafeIntegers(Number.MAX_SAFE_INTEGER, 0), Number.MAX_SAFE_INTEGER);
  assert.equal(addSafeIntegers(Number.MIN_SAFE_INTEGER, 0), Number.MIN_SAFE_INTEGER);
  assert.equal(addSafeIntegers(9007199254740990, 1), Number.MAX_SAFE_INTEGER);
  assert.equal(addSafeIntegers(-9007199254740990, -1), Number.MIN_SAFE_INTEGER);
  assert.equal(addSafeIntegers(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER), 0);
});

test("rejects invalid inputs in either position without coercion", () => {
  const invalidInputs = [
    "2", "", null, undefined, true, false, {}, [], new Number(2), 2n,
    Symbol("integer"), 0.5, -0.5, NaN, Infinity, -Infinity,
    9007199254740992, -9007199254740992,
    { valueOf() { throw new Error("Input must not be coerced"); } },
  ];

  for (const input of invalidInputs) {
    assert.throws(() => addSafeIntegers(input, 1), TypeError);
    assert.throws(() => addSafeIntegers(1, input), TypeError);
  }
});

test("rejects positive and negative sum overflow", () => {
  assert.throws(() => addSafeIntegers(Number.MAX_SAFE_INTEGER, 1), RangeError);
  assert.throws(() => addSafeIntegers(1, Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => addSafeIntegers(Number.MIN_SAFE_INTEGER, -1), RangeError);
  assert.throws(() => addSafeIntegers(-1, Number.MIN_SAFE_INTEGER), RangeError);
  assert.throws(() => addSafeIntegers(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => addSafeIntegers(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER), RangeError);
});
