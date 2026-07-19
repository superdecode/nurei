import Papa from 'papaparse'

/** Parses an uploaded CSV file's text into header-keyed rows, trimming header whitespace. */
export function parseCsvUpload<T = Record<string, string>>(
  text: string
): { data: T[]; errors: string[] } {
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return { data: parsed.data, errors: parsed.errors.map((e) => e.message) }
}
