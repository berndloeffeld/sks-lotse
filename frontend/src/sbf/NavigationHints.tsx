import type { NavigationExport } from './navigationCatalog'

// What a Navigationsaufgabe needs and how it is graded (ADR-0068): the chart as the catalog names it, the aids as the regulation says them, the grading in SKS Lotse's own
// words with their sources.
export function NavigationHints({ data }: { data: NavigationExport }) {
  return (
    <div className="flex flex-col gap-4 text-sm text-ink-soft">
      <div>
        <h3 className="font-serif text-lg text-ink">Das brauchst du selbst</h3>
        <p className="mt-1">
          Die Papierkarte „Übungskarte D49 (Mündungen der Jade, Weser und Elbe)“ und dein Navigationsbesteck. Beides
          gehört nicht zu SBF Lotse.
        </p>
        {data.aids.map((aid) => (
          <p key={aid} className="mt-2">
            {aid}
          </p>
        ))}
      </div>
      <div>
        <h3 className="font-serif text-lg text-ink">Kartenausschnitte</h3>
        <p className="mt-1">{data.chart_notice}</p>
      </div>
      <div>
        <h3 className="font-serif text-lg text-ink">Bewertung</h3>
        <ul className="mt-1 list-disc pl-5">
          {data.scoring.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs">Quelle: {data.source}</p>
    </div>
  )
}
