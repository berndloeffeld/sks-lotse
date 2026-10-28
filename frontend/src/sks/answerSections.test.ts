import { describe, expect, it } from 'vitest'

import { splitLabelledParts } from './answerSections'

describe('splitLabelledParts', () => {
  it('puts each labelled part on its own line', () => {
    const text =
      'Statische Daten: ID, Rufzeichen, Länge und Breite des Schiffes u. a. Dynamische Daten (i. W. Sensordaten): UTC, Position, Heading. Reisebezogene Daten: Tiefgang, Zielort (Destinaton), ETA u. a.'
    expect(splitLabelledParts(text)).toBe(
      'Statische Daten: ID, Rufzeichen, Länge und Breite des Schiffes u. a.\n' +
        'Dynamische Daten (i. W. Sensordaten): UTC, Position, Heading.\n' +
        'Reisebezogene Daten: Tiefgang, Zielort (Destinaton), ETA u. a.',
    )
  })

  it('leaves text alone that does not start with a label', () => {
    const text = 'Man beachtet das. Achtung: Es gilt Folgendes. Sonst: nichts.'
    expect(splitLabelledParts(text)).toBe(text)
  })

  it('leaves a single labelled part alone', () => {
    const text = 'Regel: Rot an Backbord.'
    expect(splitLabelledParts(text)).toBe(text)
  })

  it('leaves text with its own line breaks alone', () => {
    const text = 'A: eins.\nB: zwei. C: drei.'
    expect(splitLabelledParts(text)).toBe(text)
  })
})
