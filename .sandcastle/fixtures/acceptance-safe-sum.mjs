// Synthetic Sandcastle acceptance fixture
export function addSafeIntegers(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new TypeError("Both inputs must be safe integers");
  }
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError("Sum must be a safe integer");
  }
  return sum;
}
