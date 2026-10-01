import type { ReactNode } from 'react'

import type { TideAge, TideCell, TideEvent, TideForm, TideKind } from '../hooks/useTideForm'
import { EVENT_ORDINALS } from '../hooks/useTideForm'

// The "Formblatt Gezeiten" as fields, laid out like the printed form: head (ports, date, time zone,
// board time), then two halves each with the age of the tide and a table of four high/low waters
// (Bezugsort, Gezeitenunterschiede ZUG/HUG, Anschlussort, Bordzeit).

const AGES: { value: Exclude<TideAge, ''>; label: string }[] = [
  { value: 'spring', label: 'Springzeit' },
  { value: 'mid', label: 'Mittzeit' },
  { value: 'neap', label: 'Nippzeit' },
]

const ROWS: { key: 'reference' | 'difference' | 'secondary'; label: string }[] = [
  { key: 'reference', label: 'Bezugsort' },
  { key: 'difference', label: 'ZUG/HUG' },
  { key: 'secondary', label: 'Anschlussort' },
]

const INPUT = 'w-full min-w-0 rounded border border-border bg-surface px-0.5 py-0.5 font-mono text-[11px] text-ink'
const CELL = 'border border-border p-0.5'

interface TideFormFieldsProps {
  form: TideForm
  update: (change: (current: TideForm) => TideForm) => void
  clear: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-ink-soft">
      {label}
      {children}
    </label>
  )
}

export function TideFormFields({ form, update, clear }: TideFormFieldsProps) {
  // Every change works on a copy, so React sees a new form and the stored one never aliases state.
  function edit(change: (draft: TideForm) => void) {
    update((current) => {
      const draft = structuredClone(current)
      change(draft)
      return draft
    })
  }

  function head(key: 'referencePort' | 'secondaryPort' | 'secondaryPortNumber' | 'date' | 'timeZone' | 'boardTime') {
    return (
      <input
        type="text"
        value={form[key]}
        onChange={(event) => edit((draft) => void (draft[key] = event.target.value))}
        className={INPUT}
      />
    )
  }

  function cell(block: number, event: number, row: (typeof ROWS)[number]['key'], part: keyof TideCell, label: string) {
    return (
      <input
        type="text"
        aria-label={label}
        value={form.blocks[block].events[event][row][part]}
        onChange={(change) =>
          edit((draft) => void (draft.blocks[block].events[event][row][part] = change.target.value))
        }
        className={INPUT}
      />
    )
  }

  // Unique per field: the printed form has two "1." and two "2." columns in each half.
  function eventName(block: number, index: number, tide: TideEvent) {
    const kind = tide.kind ? `${tide.kind}W` : '_W'
    return `Spalte ${index + 1} (${EVENT_ORDINALS[index]}. ${kind}), ${block === 0 ? 'oben' : 'unten'}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
        <Field label="Bezugsort">{head('referencePort')}</Field>
        <Field label="Datum">{head('date')}</Field>
        <Field label="Anschlussort">{head('secondaryPort')}</Field>
        <Field label="Zeitzone">{head('timeZone')}</Field>
        <Field label="Anschlussort Nr.">{head('secondaryPortNumber')}</Field>
        <Field label="Bordzeit">{head('boardTime')}</Field>
      </div>

      {form.blocks.map((block, b) => (
        <fieldset key={b} className="flex flex-col gap-2 border-t border-border pt-3">
          <legend className="sr-only">{b === 0 ? 'Obere Hälfte' : 'Untere Hälfte'}</legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink">
            <span className="text-ink-soft underline">Alter der Gezeit:</span>
            {AGES.map((age) => (
              <label key={age.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={block.age === age.value}
                  onChange={(event) =>
                    edit((draft) => void (draft.blocks[b].age = event.target.checked ? age.value : ''))
                  }
                />
                {age.label}
              </label>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] table-fixed border-collapse text-xs">
              <thead>
                <tr>
                  <th className={`${CELL} w-20 text-left font-normal text-ink-soft`}>
                    <label className="flex flex-col gap-0.5">
                      Datum
                      <input
                        type="text"
                        value={block.date}
                        onChange={(event) => edit((draft) => void (draft.blocks[b].date = event.target.value))}
                        className={INPUT}
                      />
                    </label>
                  </th>
                  {block.events.map((tide, e) => (
                    <th key={e} colSpan={2} className={`${CELL} font-normal`}>
                      <label className="flex items-center justify-center gap-1 text-ink">
                        {EVENT_ORDINALS[e]}.
                        <select
                          aria-label={`Hoch- oder Niedrigwasser, Spalte ${e + 1}, ${b === 0 ? 'oben' : 'unten'}`}
                          value={tide.kind}
                          onChange={(event) =>
                            edit((draft) => void (draft.blocks[b].events[e].kind = event.target.value as TideKind))
                          }
                          className="rounded border border-border bg-surface font-mono text-xs"
                        >
                          <option value="">_W</option>
                          <option value="H">HW</option>
                          <option value="N">NW</option>
                        </select>
                      </label>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className={CELL} />
                  {block.events.map((_, e) => [
                    <th key={`${e}-t`} className={`${CELL} font-normal text-ink-soft`}>
                      Zeit
                    </th>,
                    <th key={`${e}-h`} className={`${CELL} font-normal text-ink-soft`}>
                      Höhe
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className={`${CELL} text-left font-normal text-ink`}>
                      {row.label}
                    </th>
                    {block.events.map((tide, e) => [
                      <td key={`${e}-t`} className={CELL}>
                        {cell(b, e, row.key, 'time', `${row.label} Zeit, ${eventName(b, e, tide)}`)}
                      </td>,
                      <td key={`${e}-h`} className={CELL}>
                        {cell(b, e, row.key, 'height', `${row.label} Höhe, ${eventName(b, e, tide)}`)}
                      </td>,
                    ])}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={`${CELL} text-left font-normal text-ink`}>
                    Bordzeit
                  </th>
                  {block.events.map((tide, e) => [
                    <td key={`${e}-t`} className={CELL}>
                      <input
                        type="text"
                        aria-label={`Bordzeit, ${eventName(b, e, tide)}`}
                        value={tide.boardTime}
                        onChange={(event) =>
                          edit((draft) => void (draft.blocks[b].events[e].boardTime = event.target.value))
                        }
                        className={INPUT}
                      />
                    </td>,
                    <td key={`${e}-h`} className={CELL} />,
                  ])}
                </tr>
              </tbody>
            </table>
          </div>
        </fieldset>
      ))}

      <p className="text-xs text-ink-soft">
        ZUG = Zeitunterschied der Gezeiten, HUG = Höhenunterschied der Gezeiten. Deine Eintragungen bleiben nur in
        diesem Browser gespeichert.
      </p>
      <button
        type="button"
        onClick={clear}
        className="self-start font-mono text-xs tracking-wide text-ink-soft uppercase underline"
      >
        Formblatt leeren
      </button>
    </div>
  )
}
