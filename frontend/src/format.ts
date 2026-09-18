// Rounded share of `part` in `total`, as a whole-number percentage — 0 for
// an empty total rather than NaN.
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}
