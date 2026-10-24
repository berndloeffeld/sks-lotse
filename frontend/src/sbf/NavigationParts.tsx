import { typoFix, type NavigationExport, type NavigationSubtask, type NavigationTask } from './navigationCatalog'

const OWN_TOLERANCE_NOTE = 'nicht amtlich, übliche Prüfungspraxis'

// The official text of a subtask's question or result, its kept line breaks shown; with the note when
// SKS Lotse corrected an obvious typo in it (ADR-0068).
export function OfficialText({
  data,
  task,
  subtask,
  field,
}: {
  data: NavigationExport
  task: NavigationTask
  subtask: NavigationSubtask
  field: 'text' | 'result'
}) {
  const fix = typoFix(data, task.number, subtask.number, field)
  return (
    <>
      <span className="whitespace-pre-line">{subtask[field]}</span>
      {fix ? (
        <span className="mt-1 block text-xs text-ink-soft">
          Tippfehler im amtlichen Text korrigiert, dort steht „{fix.official}“.
        </span>
      ) : null}
    </>
  )
}

export function OwnAnswer({ answer }: { answer: string }) {
  return (
    <div className="rounded-tile border border-border bg-surface p-3">
      <p className="text-xs text-ink-soft">Deine Antwort</p>
      <p className="whitespace-pre-line text-ink">{answer || '–'}</p>
    </div>
  )
}

// The official result, the task's footnotes it refers to, and SKS Lotse's own tolerance set apart.
export function OfficialResult({
  data,
  task,
  subtask,
}: {
  data: NavigationExport
  task: NavigationTask
  subtask: NavigationSubtask
}) {
  const footnotes = subtask.result.includes('*)') ? task.footnotes : []
  return (
    <div className="rounded-tile border-2 border-primary bg-surface p-3">
      <p className="text-xs text-ink-soft">Amtliches Ergebnis</p>
      <p className="text-ink">
        <OfficialText data={data} task={task} subtask={subtask} field="result" />
      </p>
      {footnotes.map((note) => (
        <p key={note} className="mt-2 text-xs text-ink-soft">
          {note}
        </p>
      ))}
      {subtask.own_tolerance ? (
        <p className="mt-3 border-t border-dashed border-border pt-2 text-sm text-ink-soft">
          Toleranz: {subtask.own_tolerance} <span className="text-xs">· {OWN_TOLERANCE_NOTE}</span>
        </p>
      ) : null}
    </div>
  )
}
