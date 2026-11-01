// Synthetic acceptance fixture; no BO business behavior.
export function countNonEmptyLines(text) {
  if (typeof text !== "string") {
    throw new TypeError("text must be a primitive string");
  }
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}
