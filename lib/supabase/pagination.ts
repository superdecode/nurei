/** Converts a 1-indexed page + page size into the inclusive [from, to] range `.range()` expects. */
export function toRange(page: number, pageSize: number): [number, number] {
  return [(page - 1) * pageSize, page * pageSize - 1]
}
