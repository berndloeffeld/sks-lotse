import { describe, expect, it } from 'vitest'

import { parseAnswer, serializeAnswer } from './answerTable'

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
