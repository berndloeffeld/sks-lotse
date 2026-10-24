// A Kartenaufgabe's answer can hold tables beside its text (ADR-0062). It is stored as plain text,
// a table one line per row, `| a | b | c |`, so the Lotsen-Check reads it as it is and nothing in the
// API or the database changes; the display turns those lines back into a table.
export type AnswerBlock = { kind: 'text'; text: string } | { kind: 'table'; rows: string[][] }

const SEPARATOR = '|'
const ESCAPED_SEPARATOR = '\\|'

function cellText(cell: string): string {
  return cell.replace(/\s*\n\s*/g, ' ').trim()
}

// Rows and columns left empty are dropped, so the grid's spare cells don't end up in the answer.
function filledRows(rows: string[][]): string[][] {
  const cleaned = rows.map((row) => row.map(cellText)).filter((row) => row.some((cell) => cell !== ''))
  const width = Math.max(0, ...cleaned.map((row) => row.length))
  const kept = Array.from({ length: width }, (_, c) => c).filter((c) => cleaned.some((row) => (row[c] ?? '') !== ''))
  return cleaned.map((row) => kept.map((c) => row[c] ?? ''))
}

function serializeTable(rows: string[][]): string {
  return filledRows(rows)
    .map(
      (row) =>
        `${SEPARATOR} ${row.map((cell) => cell.replaceAll(SEPARATOR, ESCAPED_SEPARATOR)).join(' | ')} ${SEPARATOR}`,
    )
    .join('\n')
}

export function serializeAnswer(blocks: AnswerBlock[]): string {
  return blocks
    .map((block) => (block.kind === 'text' ? block.text.trim() : serializeTable(block.rows)))
    .filter((part) => part !== '')
    .join('\n\n')
}

// The cells of a table row, or null for a line of text. `|BW|` inside a sentence stays text: a row
// starts and ends with the separator.
function tableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (trimmed.length < 2 || !trimmed.startsWith(SEPARATOR) || !trimmed.endsWith(SEPARATOR)) return null
  if (trimmed.endsWith(ESCAPED_SEPARATOR)) return null
  const cells: string[] = []
  let cell = ''
  const inner = trimmed.slice(1, -1)
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith(ESCAPED_SEPARATOR, i)) {
      cell += SEPARATOR
      i++
    } else if (inner[i] === SEPARATOR) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += inner[i]
    }
  }
  cells.push(cell.trim())
  return cells
}

// Rows of different length are filled up, so every column lines up.
function tableBlock(rows: string[][]): AnswerBlock {
  const width = Math.max(...rows.map((row) => row.length))
  return { kind: 'table', rows: rows.map((row) => [...row, ...Array<string>(width - row.length).fill('')]) }
}

export function parseAnswer(answer: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let text: string[] = []
  let rows: string[][] = []
  const flushText = () => {
    const joined = text.join('\n').trim()
    if (joined !== '') blocks.push({ kind: 'text', text: joined })
    text = []
  }
  const flushTable = () => {
    if (rows.length > 0) blocks.push(tableBlock(rows))
    rows = []
  }
  for (const line of answer.split('\n')) {
    const row = tableRow(line)
    if (row) {
      flushText()
      rows.push(row)
    } else {
      flushTable()
      text.push(line)
    }
  }
  flushText()
  flushTable()
  return blocks
}

// A Kartenaufgabe's answer while it is written: text, and optionally one table (ADR-0062) with
// more text below it.
export interface ChartAnswerDraft {
  above: string
  table: string[][] | null
  below: string
}

export const EMPTY_DRAFT: ChartAnswerDraft = { above: '', table: null, below: '' }

export function draftText({ above, table, below }: ChartAnswerDraft): string {
  const blocks: AnswerBlock[] = [{ kind: 'text', text: above }]
  if (table) blocks.push({ kind: 'table', rows: table }, { kind: 'text', text: below })
  return serializeAnswer(blocks)
}

// Editing the table of a draft. It keeps at least one row, and besides the label column at least one
// column for the values.
export const MIN_ROWS = 1
export const MIN_COLUMNS = 2

export function insertRow(rows: string[][], at: number): string[][] {
  return [...rows.slice(0, at), Array<string>(rows[0]?.length ?? 0).fill(''), ...rows.slice(at)]
}

export function deleteRow(rows: string[][], at: number): string[][] {
  return rows.length > MIN_ROWS ? rows.filter((_, i) => i !== at) : rows
}

export function insertColumn(rows: string[][], at: number): string[][] {
  return rows.map((row) => [...row.slice(0, at), '', ...row.slice(at)])
}

export function deleteColumn(rows: string[][], at: number): string[][] {
  return (rows[0]?.length ?? 0) > MIN_COLUMNS ? rows.map((row) => row.filter((_, j) => j !== at)) : rows
}
