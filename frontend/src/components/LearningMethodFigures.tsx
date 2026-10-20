import type { ReactNode } from 'react'

// The figures of /learning-method. All schematic: curves without a scale, never a number of the
// half-life model (ADR-0024). Inline SVG in the app's colours, so they prerender with the page
// (ADR-0025) and the crawler reads the title, description and caption.

const SVG_CLASS = 'mx-auto h-auto w-full max-w-md'

function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="my-2 flex flex-col gap-2 rounded-tile border border-border bg-surface p-3">
      {children}
      <figcaption className="text-sm text-ink-soft">{caption}</figcaption>
    </figure>
  )
}

// Points of a forgetting curve running from (x0, yTop) down to (x1, yEnd): steep at first, then
// flatter. `steepness` is the exponential's rate (larger bends it harder).
function decayPath(x0: number, x1: number, yTop: number, yEnd: number, steepness: number): string {
  const steps = 24
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const progress = (1 - Math.exp(-steepness * t)) / (1 - Math.exp(-steepness))
    return `${(x0 + (x1 - x0) * t).toFixed(1)} ${(yTop + (yEnd - yTop) * progress).toFixed(1)}`
  })
  return `M${points.join(' L')}`
}

// ---------------------------------------------------------------------------------------------
// Forgetting curve: read once vs. repeated at growing intervals.

const TOP = 40
const BASE = 190
const EXAM_X = 366
// Where the learner repeats; the gaps grow. The last one is the exam.
const REVIEW_XS = [44, 100, 180, 272, EXAM_X]
// How far the knowledge has fallen at the end of each stretch: less each time.
const FALL_TO = [120, 96, 78, 66]

export function ForgettingCurveFigure() {
  return (
    <Figure
      caption={
        <>
          Einmal durchgelesen, verblasst das Wissen schnell. Mit Wiederholungen, die immer weiter auseinanderliegen, ist
          es am Prüfungstag noch da. Schematische Darstellung.
        </>
      }
    >
      <svg
        role="img"
        aria-labelledby="lm-forget-title"
        aria-describedby="lm-forget-desc"
        viewBox="0 0 400 240"
        className={SVG_CLASS}
        fontFamily="var(--font-sans)"
      >
        <title id="lm-forget-title">Vergessenskurve ohne und mit Wiederholung</title>
        <desc id="lm-forget-desc">
          Ohne Wiederholung fällt das Wissen schnell fast auf null ab. Mit Wiederholungen in wachsenden Abständen
          springt es jedes Mal zurück nach oben und fällt jedes Mal langsamer ab, sodass am Prüfungstag noch viel da
          ist.
        </desc>
        <line x1={44} y1={30} x2={44} y2={BASE} className="stroke-ink-soft" strokeWidth={1.5} />
        <line x1={44} y1={BASE} x2={384} y2={BASE} className="stroke-ink-soft" strokeWidth={1.5} />
        <text transform="translate(14 110) rotate(-90)" textAnchor="middle" fontSize={12} className="fill-ink-soft">
          Was du noch weißt
        </text>
        <text x={384} y={207} textAnchor="end" fontSize={12} className="fill-ink-soft">
          Zeit
        </text>

        <line
          x1={EXAM_X}
          y1={30}
          x2={EXAM_X}
          y2={BASE}
          className="stroke-ink-soft"
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
        <text x={EXAM_X + 14} y={22} textAnchor="end" fontSize={12} className="fill-ink">
          Prüfung
        </text>

        <path
          d={decayPath(44, EXAM_X, TOP, 184, 3.2)}
          fill="none"
          className="stroke-ink-soft"
          strokeWidth={2}
          strokeDasharray="5 4"
        />

        {FALL_TO.map((fall, i) => (
          <path
            key={REVIEW_XS[i]}
            d={decayPath(REVIEW_XS[i], REVIEW_XS[i + 1], TOP, fall, 3)}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        {FALL_TO.slice(0, -1).map((fall, i) => (
          <line
            key={REVIEW_XS[i + 1]}
            x1={REVIEW_XS[i + 1]}
            y1={fall}
            x2={REVIEW_XS[i + 1]}
            y2={TOP}
            className="stroke-primary"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            opacity={0.6}
          />
        ))}
        {REVIEW_XS.slice(0, -1).map((x) => (
          <circle key={x} cx={x} cy={TOP} r={4.5} className="fill-primary" />
        ))}
        <text x={REVIEW_XS[1]} y={28} textAnchor="middle" fontSize={12} className="fill-primary">
          Wiederholung
        </text>

        <line x1={44} y1={228} x2={68} y2={228} className="stroke-ink-soft" strokeWidth={2} strokeDasharray="5 4" />
        <text x={74} y={232} fontSize={12} className="fill-ink">
          einmal durchgelesen
        </text>
        <line x1={214} y1={228} x2={238} y2={228} className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" />
        <text x={244} y={232} fontSize={12} className="fill-ink">
          mit Wiederholung
        </text>
      </svg>
    </Figure>
  )
}

// ---------------------------------------------------------------------------------------------
// The classic flash-card box.

const BOXES = [
  { x: 24, title: 'Fach 1', note: 'am häufigsten' },
  { x: 150, title: 'Fach 2', note: 'seltener' },
  { x: 276, title: 'Fach 3', note: 'am seltensten' },
]
const BOX_TOP = 62
const BOX_WIDTH = 100
const BOX_HEIGHT = 60

export function FlashcardBoxFigure() {
  return (
    <Figure
      caption={
        <>
          Die klassische Lernkartei: Was du weißt, wandert ein Fach weiter und kommt seltener dran. Was du nicht
          wusstest, geht zurück ins erste Fach. SKS Lotse führt diese Buchhaltung für jede Frage selbst – ohne feste
          Fächer.
        </>
      }
    >
      <svg
        role="img"
        aria-labelledby="lm-box-title"
        aria-describedby="lm-box-desc"
        viewBox="0 0 400 236"
        className={SVG_CLASS}
        fontFamily="var(--font-sans)"
      >
        <title id="lm-box-title">Die klassische Lernkartei mit drei Fächern</title>
        <desc id="lm-box-desc">
          Eine gewusste Karte wandert von Fach 1 nach Fach 2 und von dort nach Fach 3, wo sie am seltensten drankommt.
          Eine nicht gewusste Karte geht aus jedem Fach zurück ins erste.
        </desc>
        <defs>
          <marker id="lm-arrow-ok" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0 0 8 4 0 8Z" className="fill-success" />
          </marker>
          <marker id="lm-arrow-bad" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0 0 8 4 0 8Z" className="fill-danger" />
          </marker>
        </defs>

        {BOXES.map(({ x, title, note }) => (
          <g key={title}>
            <rect
              x={x}
              y={BOX_TOP}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx={2}
              className="fill-surface-alt stroke-ink-soft"
              strokeWidth={1.5}
            />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={x + 10 + i * 6}
                y={BOX_TOP + 8 + i * 5}
                width={50}
                height={32}
                rx={2}
                className="fill-surface stroke-border"
                strokeWidth={1.2}
              />
            ))}
            <text x={x + BOX_WIDTH / 2} y={142} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-ink">
              {title}
            </text>
            <text x={x + BOX_WIDTH / 2} y={158} textAnchor="middle" fontSize={12} className="fill-ink-soft">
              {note}
            </text>
          </g>
        ))}

        <path
          d="M74 56Q130 6 186 52"
          fill="none"
          className="stroke-success"
          strokeWidth={2}
          markerEnd="url(#lm-arrow-ok)"
        />
        <path
          d="M214 56Q270 6 326 52"
          fill="none"
          className="stroke-success"
          strokeWidth={2}
          markerEnd="url(#lm-arrow-ok)"
        />
        <text x={130} y={22} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-success">
          gewusst
        </text>
        <text x={270} y={22} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-success">
          gewusst
        </text>

        <path
          d="M326 172Q200 236 74 176"
          fill="none"
          className="stroke-danger"
          strokeWidth={2}
          markerEnd="url(#lm-arrow-bad)"
        />
        <text x={200} y={224} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-danger">
          nicht gewusst: zurück zu Fach 1
        </text>
      </svg>
    </Figure>
  )
}

// ---------------------------------------------------------------------------------------------
// What a grading does to a question's curve.

const PANEL_WIDTH = 112
const PANEL_XS = [4, 144, 284]
const PLOT_TOP = 30
const PLOT_HEIGHT = 80
const PLOT_LEFT = 10
const PLOT_WIDTH = 92
const TIME_SPAN = 2
// The curve before the grading, and after it: a time constant per grading (longer = flatter).
const BEFORE = 0.8
const PANELS = [
  {
    title: 'Richtig',
    note: 'hält länger',
    after: 1.8,
    stroke: 'stroke-success',
    fill: 'fill-success',
  },
  {
    title: 'Teilweise richtig',
    note: 'hält kürzer',
    after: 0.45,
    stroke: 'stroke-accent',
    fill: 'fill-accent',
  },
  {
    title: 'Falsch',
    note: 'hält viel kürzer',
    after: 0.25,
    stroke: 'stroke-danger',
    fill: 'fill-danger',
  },
]

// Knowledge falls as exp(-t / tau); the curve is drawn from 1 at the top down to 0 at the base.
function panelCurve(left: number, tau: number): string {
  const steps = 32
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * TIME_SPAN
    const x = left + PLOT_LEFT + (t / TIME_SPAN) * PLOT_WIDTH
    const y = PLOT_TOP + PLOT_HEIGHT * (1 - Math.exp(-t / tau))
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M${points.join(' L')}`
}

// Where the curve passes half of what was known: the half-life.
function halfLifePoint(left: number, tau: number): { x: number; y: number } {
  const t = tau * Math.LN2
  return { x: left + PLOT_LEFT + (t / TIME_SPAN) * PLOT_WIDTH, y: PLOT_TOP + PLOT_HEIGHT / 2 }
}

export function GradeEffectFigure() {
  return (
    <Figure
      caption={
        <>
          So verändert deine Bewertung die geschätzte Kurve einer Frage. Der Punkt markiert die Halbwertszeit: den
          Moment, in dem du nur noch etwa die Hälfte weißt. Schematische Darstellung.
        </>
      }
    >
      <svg
        role="img"
        aria-labelledby="lm-grade-title"
        aria-describedby="lm-grade-desc"
        viewBox="0 0 400 196"
        className={SVG_CLASS}
        fontFamily="var(--font-sans)"
      >
        <title id="lm-grade-title">Wie die Bewertung die Vergessenskurve verändert</title>
        <desc id="lm-grade-desc">
          Nach „Richtig“ verläuft die Kurve flacher, die Halbwertszeit wird länger. Nach „Teilweise richtig“ fällt sie
          steiler ab, nach „Falsch“ noch viel steiler.
        </desc>
        {PANELS.map(({ title, note, after, stroke, fill }, i) => {
          const left = PANEL_XS[i]
          const before = halfLifePoint(left, BEFORE)
          const now = halfLifePoint(left, after)
          return (
            <g key={title}>
              <rect
                x={left}
                y={14}
                width={PANEL_WIDTH}
                height={112}
                rx={2}
                className="fill-surface stroke-border"
                strokeWidth={1.2}
              />
              <line
                x1={left + PLOT_LEFT}
                y1={PLOT_TOP + PLOT_HEIGHT / 2}
                x2={left + PLOT_LEFT + PLOT_WIDTH}
                y2={PLOT_TOP + PLOT_HEIGHT / 2}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {i === 0 ? (
                <text
                  x={left + PLOT_LEFT + PLOT_WIDTH}
                  y={PLOT_TOP + PLOT_HEIGHT / 2 - 4}
                  textAnchor="end"
                  fontSize={11}
                  className="fill-ink-soft"
                >
                  Hälfte
                </text>
              ) : null}
              <path
                d={panelCurve(left, BEFORE)}
                fill="none"
                className="stroke-ink-soft"
                strokeWidth={1.8}
                strokeDasharray="4 3"
              />
              <path
                d={panelCurve(left, after)}
                fill="none"
                className={stroke}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={before.x} cy={before.y} r={3.5} className="fill-surface stroke-ink-soft" strokeWidth={1.5} />
              <circle cx={now.x} cy={now.y} r={4} className={fill} />
              <text
                x={left + PANEL_WIDTH / 2}
                y={146}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                className="fill-ink"
              >
                {title}
              </text>
              <text x={left + PANEL_WIDTH / 2} y={162} textAnchor="middle" fontSize={11} className="fill-ink-soft">
                {note}
              </text>
            </g>
          )
        })}

        <line x1={4} y1={186} x2={24} y2={186} className="stroke-ink-soft" strokeWidth={1.8} strokeDasharray="4 3" />
        <text x={30} y={190} fontSize={11} className="fill-ink">
          vorher
        </text>
        <line x1={100} y1={186} x2={120} y2={186} className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" />
        <text x={126} y={190} fontSize={11} className="fill-ink">
          nachher
        </text>
        <circle cx={215} cy={186} r={4} className="fill-ink" />
        <text x={223} y={190} fontSize={11} className="fill-ink">
          Halbwertszeit
        </text>
      </svg>
    </Figure>
  )
}
