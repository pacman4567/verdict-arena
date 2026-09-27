export function compare(
  actual: string,
  expected: string,
  mode: string,
  tolerance: number,
) {
  if (mode === "exact")
    return actual.replace(/\r\n/g, "\n") === expected.replace(/\r\n/g, "\n");
  const a = actual.trim().split(/\s+/),
    b = expected.trim().split(/\s+/);
  if (a.length !== b.length) return false;
  return a.every((v, i) => {
    if (mode !== "float") return v === b[i];
    const x = Number(v),
      y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || v === "" || b[i] === "")
      return v === b[i];
    return Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(y));
  });
}
