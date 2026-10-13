import { describe, expect, it } from 'vitest'

import {
  EMPTY_DRAFT,
  deleteColumn,
  deleteRow,
  draftText,
  insertColumn,
  insertRow,
  parseAnswer,
  serializeAnswer,
} from './answerTable'

describe('serializeAnswer', () => {
  it('writes a table one row per line, between the text before and after it', () => {
    expect(
      serializeAnswer([
        { kind: 'text', text: '  HW Helgoland:  ' },
        {
          kind: 'table',
          rows: [
            ['HW Cuxhaven', '08:53', '3,2 m'],
            ['Unterschied', '-01:10', '-0,3 m'],
          ],
        },
        { kind: 'text', text: 'HWZ 07:43' },
      ]),
    ).toBe('HW Helgoland:\n\n| HW Cuxhaven | 08:53 | 3,2 m |\n| Unterschied | -01:10 | -0,3 m |\n\nHWZ 07:43')
  })

  it('drops empty rows, empty columns, empty tables and empty text', () => {
    expect(
      serializeAnswer([
        { kind: 'text', text: '' },
        {
          kind: 'table',
          rows: [
            ['a', '', 'b'],
            [' ', '', ''],
            ['', '', 'c'],
          ],
        },
        { kind: 'text', text: '   ' },
        {
          kind: 'table',
          rows: [
            ['', ''],
            ['', ''],
          ],
        },
      ]),
    ).toBe('| a | b |\n|  | c |')
  })

  it('escapes the separator and folds line breaks inside a cell', () => {
    expect(serializeAnswer([{ kind: 'table', rows: [['|BW|', 'a\n  b']] }])).toBe('| \\|BW\\| | a b |')
  })

  it('keeps an answer without a table as its text', () => {
    expect(serializeAnswer([{ kind: 'text', text: 'HWZ 08:53\nHWH 3,2 m' }])).toBe('HWZ 08:53\nHWH 3,2 m')
    expect(serializeAnswer([])).toBe('')
  })
})

describe('parseAnswer', () => {
  it('reads back what serializeAnswer wrote', () => {
    const blocks = [
      { kind: 'text' as const, text: 'Vorher\nzwei Zeilen' },
      {
        kind: 'table' as const,
        rows: [
          ['x | y', '1'],
          ['', '2'],
        ],
      },
      { kind: 'text' as const, text: 'Nachher' },
      { kind: 'table' as const, rows: [['a', 'b']] },
    ]
    expect(parseAnswer(serializeAnswer(blocks))).toEqual(blocks)
  })

  it('keeps prose with |BW| and stray separators as text', () => {
    expect(parseAnswer('|BW| = 5°\nKurs | 090°\n|\n| a \\|')).toEqual([
      { kind: 'text', text: '|BW| = 5°\nKurs | 090°\n|\n| a \\|' },
    ])
  })

  it('fills up rows of different length and tolerates spaces around a row', () => {
    expect(parseAnswer('  | a | b | c |  \n|d|')).toEqual([
      {
        kind: 'table',
        rows: [
          ['a', 'b', 'c'],
          ['d', '', ''],
        ],
      },
    ])
  })

  it('starts a new table after a line of text', () => {
    expect(parseAnswer('| a |\nText\n| b |')).toEqual([
      { kind: 'table', rows: [['a']] },
      { kind: 'text', text: 'Text' },
      { kind: 'table', rows: [['b']] },
    ])
  })

  it('reads an empty answer as nothing', () => {
    expect(parseAnswer('')).toEqual([])
    expect(parseAnswer('\n  \n')).toEqual([])
  })
})

describe('draftText', () => {
  it('is the text alone without a table', () => {
    expect(draftText(EMPTY_DRAFT)).toBe('')
    expect(draftText({ above: ' HWZ 08:53 ', table: null, below: 'left over' })).toBe('HWZ 08:53')
  })

  it('puts the table between the text above and below it', () => {
    expect(draftText({ above: 'oben', table: [['HW', '12:30']], below: 'unten' })).toBe(
      'oben\n\n| HW | 12:30 |\n\nunten',
    )
  })
})

describe('editing the table', () => {
  const rows = [
    ['a', 'b', 'c'],
    ['d', 'e', 'f'],
  ]

  it('inserts an empty row before the given one', () => {
    expect(insertRow(rows, 0)).toEqual([['', '', ''], ...rows])
    expect(insertRow(rows, 1)).toEqual([rows[0], ['', '', ''], rows[1]])
    expect(insertRow(rows, 2)).toEqual([...rows, ['', '', '']])
  })

  it('inserts an empty column before the given one', () => {
    expect(insertColumn(rows, 0)).toEqual([
      ['', 'a', 'b', 'c'],
      ['', 'd', 'e', 'f'],
    ])
    expect(insertColumn(rows, 3)).toEqual([
      ['a', 'b', 'c', ''],
      ['d', 'e', 'f', ''],
    ])
  })

  it('deletes the given row, but never the last one', () => {
    expect(deleteRow(rows, 0)).toEqual([rows[1]])
    expect(deleteRow(rows, 1)).toEqual([rows[0]])
    expect(deleteRow([['a', 'b']], 0)).toEqual([['a', 'b']])
  })

  it('deletes the given column, but keeps the label column and one more', () => {
    expect(deleteColumn(rows, 1)).toEqual([
      ['a', 'c'],
      ['d', 'f'],
    ])
    expect(deleteColumn(rows, 0)).toEqual([
      ['b', 'c'],
      ['e', 'f'],
    ])
    expect(deleteColumn([['a', 'b']], 1)).toEqual([['a', 'b']])
  })
})
