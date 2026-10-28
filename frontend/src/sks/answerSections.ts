// Some official answers run their parts together in one paragraph, each part opened by a label:
// "Statische Daten: ... Dynamische Daten (i. W. Sensordaten): ... Reisebezogene Daten: ...". The
// catalog PDF sets them on lines of their own, the extraction loses that. This puts them back for
// display only; the wording is never touched, only a space before a label becomes a line break.
// A label is capitalised words, optionally a parenthesis, then a colon, and it follows a full stop.
const LABEL_AFTER_SENTENCE = /(?<=\.) (?=[A-ZÄÖÜ][\wäöüß-]*(?: [A-ZÄÖÜ][\wäöüß-]*)*(?: \([^()]*\))?:)/g
const LABEL_AT_START = /^[A-ZÄÖÜ][\wäöüß-]*(?: [A-ZÄÖÜ][\wäöüß-]*)*(?: \([^()]*\))?:/

// Only an answer built as a list of labelled parts (it starts with a label and has at least one
// more) is split: a sentence like "Beachte. Achtung: ..." elsewhere stays as it is.
export function splitLabelledParts(text: string): string {
  if (text.includes('\n') || !LABEL_AT_START.test(text)) return text
  const split = text.replace(LABEL_AFTER_SENTENCE, '\n')
  return split.includes('\n') ? split : text
}
