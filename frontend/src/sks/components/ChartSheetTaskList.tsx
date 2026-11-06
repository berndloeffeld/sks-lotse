import type { ChartSheet } from '../chartCatalog'
import { taskView } from '../chartGuestRun'
import { pointsLabel } from '../chartPoints'
import { ChartTaskText, OfficialSolution } from './ChartContent'
import { sectionHeading } from './headingStyles'

// Every task of a sheet with its official solution, each folded shut, below the sheet's page
// (ADR-0056, like TopicQuestionList for a topic): to look one up, and so the page's HTML carries the
// whole sheet for search engines while the solution stays hidden until it is opened.
export function ChartSheetTaskList({ sheet }: { sheet: ChartSheet }) {
  return (
    <section aria-labelledby="sheet-tasks" className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 id="sheet-tasks" className={sectionHeading}>
        Alle Aufgaben dieser Kartenaufgabe
      </h2>
      <ul className="flex flex-col">
        {sheet.tasks.map((task) => (
          <li key={task.number} id={`aufgabe-${task.number}`} className="border-b border-border last:border-b-0">
            <details className="group py-3">
              <summary className="flex cursor-pointer justify-between gap-3 text-ink marker:content-none">
                <span>Aufgabe {task.number}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs leading-6 text-ink-soft">{pointsLabel(task.points)}</span>
                  <span aria-hidden="true" className="text-ink-soft transition group-open:rotate-90">
                    ›
                  </span>
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <ChartTaskText task={taskView(task, undefined, true)} />
                <OfficialSolution task={taskView(task, undefined, true)} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
