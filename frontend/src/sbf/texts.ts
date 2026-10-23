import type { PageText } from '../publicPageTexts'

// The SBF site's page titles and descriptions (SEO copy, like ../publicPageTexts.ts for SKS Lotse;
// a pure text module, left out of the mutation scope for the same reason). The home page's are
// index.sbf.html's own; sbf/publicPages.test.ts checks they match.

export const SBF_HOME_TITLE = 'SBF See: Navigationsaufgaben online üben – SBF Lotse'

export const SBF_FAQ_TEXT: PageText = {
  title: 'Häufige Fragen zu SBF Lotse und zur Navigationsaufgabe',
  description:
    'Was SBF Lotse ist, wie die Navigationsaufgabe im Sportbootführerschein See bewertet wird und woher die amtlichen Aufgaben stammen.',
}

export const SBF_IMPRINT_TEXT: PageText = {
  title: 'Impressum – SBF Lotse',
  description: 'Impressum und Anbieterkennzeichnung von SBF Lotse.',
}

export const SBF_PRIVACY_TEXT: PageText = {
  title: 'Datenschutzerklärung – SBF Lotse',
  description: 'Welche Daten SBF Lotse verarbeitet, wofür und auf welcher Rechtsgrundlage.',
}
