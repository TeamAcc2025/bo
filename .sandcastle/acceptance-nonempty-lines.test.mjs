import assert from "node:assert/strict";
import test from "node:test";
import { countNonEmptyLines } from "./fixtures/acceptance-nonempty-lines.mjs";

// Synthetic acceptance coverage; no BO business behavior.
test("empty and whitespace-only strings have no nonempty lines", () => {
  for (const text of ["", " ", "\t", "\n", "\r\n", " \t\n\r\n \t"]) {
    assert.equal(countNonEmptyLines(text), 0);
  }
});

test("counts LF and CRLF lines while ignoring blank lines and trailing newlines", () => {
  for (const text of [
    "alpha\nbeta",
    "alpha\r\nbeta",
    "\n alpha \n\t\nbeta\n\n",
    "\r\n alpha \r\n \t\r\nbeta\r\n\r\n",
    "alpha\r\n\t\nbeta\n\r\n",
  ]) {
    assert.equal(countNonEmptyLines(text), 2);
  }
  assert.equal(countNonEmptyLines("alpha\n"), 1);
  assert.equal(countNonEmptyLines("alpha\r\n"), 1);
});

test("counts Unicode text and uses trim semantics for Unicode whitespace", () => {
  assert.equal(countNonEmptyLines("\u00a0\n\u2003\r\n\uFEFF"), 0);
  assert.equal(countNonEmptyLines("\u2003café\u00a0\n\u2003\n日本語\r\n🌱\n"), 3);
  assert.equal(countNonEmptyLines("\u200b"), 1);
});

test("rejects every non-string input with TypeError without coercion", () => {
  const nonStrings = [
    undefined,
    null,
    false,
    true,
    0,
    42,
    NaN,
    1n,
    Symbol("synthetic"),
    [],
    {},
    () => "alpha",
    new String("alpha"),
    { split: () => ["alpha"] },
    {
      [Symbol.toPrimitive]() {
        assert.fail("non-string inputs must not be coerced");
      },
    },
  ];
  for (const value of nonStrings) {
    assert.throws(() => countNonEmptyLines(value), TypeError);
  }
});
