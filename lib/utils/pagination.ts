/** Client-side pagination page count, floored at 1 so page controls never show "0 / 0". */
export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize))
}
