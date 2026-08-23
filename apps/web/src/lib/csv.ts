/**
 * CSV shared by the download endpoints and the in-page export buttons.
 *
 * Excel is the reader these files are opened in, and it only detects UTF-8 from a byte-order mark:
 * without {@link CSV_BOM} every å/ä/ö in a participant name comes out as mojibake.
 */

export const CSV_BOM = '\uFEFF'

export type CsvCell = string | number | null | undefined

function escapeCsvCell(value: CsvCell): string {
  const text = value === null || value === undefined ? '' : String(value)

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** RFC 4180: CRLF line endings, quotes doubled inside a quoted field. */
export function buildCsv<Header extends string>(
  headers: readonly Header[],
  rows: readonly Readonly<Record<Header, CsvCell>>[],
): string {
  const lines = [headers.map(escapeCsvCell).join(',')]

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','))
  }

  return lines.join('\r\n')
}

/** Browser-side download of a CSV built by {@link buildCsv}. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
