/**
 * Minimal RFC 4180 CSV reader/writer.
 *
 * GTFS is CSV with quoted fields that may contain commas, quotes and newlines, so a
 * `split(',')` would corrupt agency names. Kept dependency-free on purpose: the feed
 * layer has to be auditable.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }

  const pushRow = () => {
    pushField()
    // Ignore a trailing empty line produced by a final newline.
    if (!(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
    row = []
  }

  while (index < input.length) {
    const char = input[index]

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }

    if (char === ',') {
      pushField()
      index += 1
      continue
    }

    if (char === '\r') {
      index += 1
      continue
    }

    if (char === '\n') {
      pushRow()
      index += 1
      continue
    }

    field += char
    index += 1
  }

  if (field !== '' || row.length > 0) {
    pushRow()
  }

  return rows
}

export function formatCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return `${rows.map((row) => row.map(formatField).join(',')).join('\n')}\n`
}

function formatField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Rows as objects keyed by the header row; a missing cell becomes an empty string. */
export function parseCsvObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input)
  const [header, ...body] = rows
  if (header === undefined) {
    return []
  }
  return body.map((row) => {
    const record: Record<string, string> = {}
    header.forEach((name, column) => {
      record[name.trim()] = (row[column] ?? '').trim()
    })
    return record
  })
}
