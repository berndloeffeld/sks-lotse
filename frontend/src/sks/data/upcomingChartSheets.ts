// The WSV's solved Kartenaufgaben not transcribed yet (ADR-0052, ADR-0053): the overview shows them as tiles that say
// so. Tour and summary are our own words, like those in chart_exercises.yaml. An entry goes in the PR that adds its
// sheet; upcomingChartSheets (chartCatalog.ts) hides it anyway once the sheet is in the data.

export interface UpcomingChartSheet {
  number: number
  title: string
  summary: string
}

export const UPCOMING_CHART_SHEETS: UpcomingChartSheet[] = [
  {
    number: 8,
    title: 'Großtonne GB → Cuxhaven',
    summary: 'Nachtfahrt in die Elbe mit Stromdreieck, Kimmabstand, Radarpeilung und Kompasskontrolle.',
  },
  {
    number: 9,
    title: 'Wurster Watt → Neuwerk',
    summary: 'Von der Neuen Weser zur Elbmündung, mit Kartenberichtigung, Stromdreieck, Kreuzpeilung und Tidenfall.',
  },
  {
    number: 10,
    title: 'Cuxhaven → Spiekeroog',
    summary:
      'Rund um Helgoland, mit Stromdreieck, GPS-Abgleich, Kreuzpeilung und Querung des Verkehrstrennungsgebiets.',
  },
]
