import type { ChartSheet } from './chartCatalog'

// The wording of the prerendered pages' titles, descriptions and breadcrumb names (SEO copy, see
// publicPages.ts). A pure text module: left out of the mutation scope on purpose, since a mutant
// that changes a sentence is not a bug the tests could sensibly pin down.

export interface PageText {
  title: string
  description: string
}

export const ROOT_CRUMB = 'SKS Lotse'
export const LEARN_CRUMB = 'Fragenkatalog'
export const CHARTS_CRUMB = 'Kartenaufgaben'
export const EXAM_PROCESS_CRUMB = 'So läuft die SKS-Prüfung ab'

export const FAQ_TEXT: PageText = {
  title: 'Häufige Fragen zur SKS-Theorieprüfung – SKS Lotse',
  description:
    'Antworten rund um den amtlichen SKS-Fragenkatalog, den Lernstand und die Probeprüfung der SKS App – für alle, die sich auf die SKS-Theorieprüfung vorbereiten.',
}

export const IMPRINT_TEXT: PageText = {
  title: 'Impressum – SKS Lotse',
  description: 'Impressum und Anbieterkennzeichnung von SKS Lotse, der App zum Lernen für die SKS-Theorieprüfung.',
}

export const PRIVACY_TEXT: PageText = {
  title: 'Datenschutz – SKS Lotse',
  description:
    'Datenschutzerklärung von SKS Lotse: welche Daten beim Lernen für die SKS-Theorieprüfung verarbeitet werden und wie du sie löschen kannst.',
}

export const TERMS_TEXT: PageText = {
  title: 'AGB – SKS Lotse',
  description:
    'Allgemeine Geschäftsbedingungen von SKS Lotse, der Online-App für die Vorbereitung auf die SKS-Theorieprüfung.',
}

export const EXAM_PROCESS_TEXT: PageText = {
  title: 'So läuft die SKS-Prüfung ab – SBF See, Theorie und Praxis',
  description:
    'Der komplette Weg zum Sportküstenschifferschein: vom Bootsführerschein SBF See über die SKS-Theorieprüfung bis zur Praxisprüfung – kompakt erklärt.',
}

export const PRICING_TEXT: PageText = {
  title: 'Preise – SKS Lotse',
  description:
    'Was SKS Lotse kostet: Fragen üben, Musterantwort und Lernfortschritt bleiben kostenlos, Tokens für den Lotsen-Check gibt es in Paketen ohne Abo.',
}

export function learnIndexText(total: number): PageText {
  return {
    title: 'SKS-Fragenkatalog online lernen – alle Themen – SKS Lotse',
    description: `Alle ${total} Fragen des amtlichen SKS-Fragenkatalogs nach Themen: Navigation, Schifffahrtsrecht, Wetterkunde und Seemannschaft – kostenlos üben, auch ohne Anmeldung.`,
  }
}

export function topicText(topicName: string, subject: string, count: number): PageText {
  return {
    title: `${topicName} – SKS-Fragen ${subject} – SKS Lotse`,
    description: `Alle ${count} amtlichen SKS-Fragen zum Thema ${topicName} (${subject}) mit Musterantwort – kostenlos üben, auch ohne Anmeldung.`,
  }
}

export const CHARTS_INDEX_TEXT: PageText = {
  title: 'SKS-Kartenaufgaben online üben – SKS Lotse',
  description:
    'Die amtlichen Kartenaufgaben der SKS-Prüfung mit Lösung und Herleitung, Aufgabe für Aufgabe – kostenlos üben, auch ohne Anmeldung.',
}

export function sheetText(sheet: ChartSheet, maxPoints: number): PageText {
  return {
    title: `Kartenaufgabe ${sheet.number}: ${sheet.title} – SKS-Navigation – SKS Lotse`,
    description: `Amtliche SKS-Kartenaufgabe ${sheet.number}, ${sheet.title}: ${sheet.summary} ${sheet.tasks.length} Aufgaben, ${maxPoints} Punkte, mit amtlicher Lösung und Herleitung – kostenlos üben, auch ohne Anmeldung.`,
  }
}

export function sheetCrumb(number: number | string): string {
  return `Kartenaufgabe ${number}`
}
