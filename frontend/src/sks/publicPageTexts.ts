import type { PageText } from '../shared/publicPages'
import type { ChartSheet } from './chartCatalog'

// The wording of the prerendered pages' titles, descriptions and breadcrumb names (SEO copy, see
// publicPages.ts). A pure text module: left out of the mutation scope on purpose, since a mutant
// that changes a sentence is not a bug the tests could sensibly pin down.
//
// Search results show about 580 px of a title and 1000 px of a description (Arial 20 px and 14 px,
// as SEO tools measure them): keep within. A title that already says "SKS" leaves out
// "– SKS Lotse", since the home page's WebSite JSON-LD gives search engines the site's name.

export const ROOT_CRUMB = 'SKS Lotse'
export const LEARN_CRUMB = 'Fragenkatalog'
export const CHARTS_CRUMB = 'Kartenaufgaben'
export const EXAM_PROCESS_CRUMB = 'So läuft die SKS-Prüfung ab'
export const LEARNING_METHOD_CRUMB = 'Lernmethode'

export const FAQ_TEXT: PageText = {
  title: 'Häufige Fragen zur SKS-Theorieprüfung',
  description:
    'Antworten zum amtlichen SKS-Fragenkatalog, zu Lernstand, Probeprüfung und Lotsen-Check – für alle, die sich auf die SKS-Theorieprüfung vorbereiten.',
}

export const IMPRINT_TEXT: PageText = {
  title: 'Impressum – SKS Lotse',
  description: 'Impressum und Anbieterkennzeichnung von SKS Lotse, der App zum Lernen für die SKS-Theorieprüfung.',
}

export const PRIVACY_TEXT: PageText = {
  title: 'Datenschutz – SKS Lotse',
  description:
    'Datenschutzerklärung von SKS Lotse: welche Daten beim Lernen für die SKS-Theorieprüfung verarbeitet werden und wie Sie sie löschen können.',
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

export const LEARNING_METHOD_TEXT: PageText = {
  title: 'SKS-Fragenkatalog lernen mit dem Karteikarten-Prinzip',
  description:
    'SKS-Theorie lernen wie mit Karteikarten: Fragen kommen in wachsenden Abständen zurück, bevor du sie vergisst – so funktioniert das Lernsystem von SKS Lotse.',
}

export const PRICING_TEXT: PageText = {
  title: 'Preise: kostenlos lernen, Lotsen-Check ohne Abo – SKS Lotse',
  description:
    'Was SKS Lotse kostet: Fragen üben, Antwort und Lernfortschritt bleiben kostenlos, Tokens für den Lotsen-Check gibt es in Paketen ohne Abo.',
}

export function learnIndexText(total: number): PageText {
  return {
    title: 'SKS-Fragenkatalog online lernen: alle Fragen nach Themen',
    description: `Alle ${total} Fragen des amtlichen SKS-Fragenkatalogs nach Themen: Navigation, Schifffahrtsrecht, Wetterkunde, Seemannschaft – kostenlos, ohne Anmeldung.`,
  }
}

export function topicText(topicName: string, subject: string, count: number): PageText {
  return {
    title: `${topicName} – SKS-Fragen mit Antworten`,
    description: `${subject}: alle ${count} amtlichen SKS-Fragen zu ${topicName} mit Antwort – kostenlos üben, ohne Anmeldung.`,
  }
}

// The title for a topic whose name is too long for topicText's (publicPages.ts decides).
export function shortTopicTitle(topicName: string): string {
  return `${topicName} – SKS-Fragen`
}

export const CHARTS_INDEX_TEXT: PageText = {
  title: 'SKS-Kartenaufgaben online üben – mit Lösung & Herleitung',
  description:
    'Die amtlichen Kartenaufgaben der SKS-Prüfung mit Lösung und Herleitung, Aufgabe für Aufgabe – kostenlos üben, auch ohne Anmeldung.',
}

export function sheetText(sheet: ChartSheet, maxPoints: number): PageText {
  return {
    title: `Kartenaufgabe ${sheet.number}: ${sheet.title} – SKS-Navigation`,
    description: `SKS-Kartenaufgabe ${sheet.number} (${sheet.title}): ${sheet.tasks.length} Aufgaben, ${maxPoints} Punkte, mit amtlicher Lösung und Herleitung – kostenlos, ohne Anmeldung.`,
  }
}

export function sheetCrumb(number: number | string): string {
  return `Kartenaufgabe ${number}`
}
