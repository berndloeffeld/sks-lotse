import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'

import { trackLandingClick, trackSignupClick, type LandingSection, type LandingTarget } from '../../shared/analytics'

import { chartExercisesForGuests } from '../chartCatalog'
import { BAND_CONTENT as CONTENT, Columns } from '../../shared/components/Bands'
import { ChartDividersIcon } from '../components/icons/FeatureIcons'
import { FaqAnswer } from '../../shared/components/FaqAnswer'
import { Header } from '../components/Header'
import { HeroBand } from '../../shared/components/HeroBand'
import { HeroSampleQuestion } from '../components/HeroSampleQuestion'
import { LegalFooter } from '../../shared/components/LegalFooter'
import { LoginForm } from '../../shared/components/LoginForm'
import { SignupBonusNote } from '../components/SignupBonusNote'
import { MainNav } from '../components/MainNav'
import { MobileTabBar } from '../components/MobileTabBar'
import { ShareLinks } from '../components/ShareLinks'
import { FAQ } from '../faq'
import { HOME_TITLE, useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useSectionSeen } from '../hooks/useSectionSeen'
import { useAuthStore } from '../../shared/store/authStore'
import { buttonClass } from '../../shared/components/buttonStyles'

// A short, first-time-visitor-relevant excerpt of the full FAQ (order
// preserved from the shared FAQ array), each linking to its /faq#<id> anchor.
const LANDING_FAQ_IDS = new Set(['quelle', 'ohne-anmeldung', 'app', 'varianten', 'gelernt', 'pruefungssimulation'])
const LANDING_FAQ = FAQ.filter((entry) => LANDING_FAQ_IDS.has(entry.id))

// Banded layout after a website template: full-width color bands (light
// bg / primary / primary-dark) alternating down the page, a slanted hero
// edge, three-column text blocks and a sign-up form band. Palette, type and
// square-cornered chrome stay per ADR-0014.

// Real screenshots of the running app (public/screenshots), cropped to the
// content column; the demo account's data is made up.
const SCREENSHOTS = [
  {
    src: '/screenshots/frage-beantworten.png',
    width: 1328,
    height: 742,
    title: '1. Frage beantworten',
    text: 'Eine Frage aus dem Katalog, dazu ein optionales Notizfeld für deine Antwort – sie wird nicht gespeichert.',
    alt: 'Screenshot: Die Frage „Was bedeutet die Abkürzung GPS?“ mit ausgefülltem Antwortfeld und der Schaltfläche „Lösung anzeigen“.',
    wide: false,
  },
  {
    src: '/screenshots/selbst-bewerten.png',
    width: 1328,
    height: 550,
    title: '2. Mit der amtlichen Antwort vergleichen',
    text: 'Neben deiner Antwort steht die amtliche Antwort – so siehst du direkt, was gefehlt hat.',
    alt: 'Screenshot: Deine Antwort zur Frage „Was bedeutet die Abkürzung GPS?“ neben der amtlichen Antwort „Global Positioning System“.',
    wide: false,
  },
  {
    src: '/screenshots/ki-bewertung.png',
    width: 1328,
    height: 396,
    title: '3. Selbst bewerten – mit KI-Vorschlag',
    text: 'Du bewertest dich selbst: richtig, teilweise richtig oder falsch. Auf Wunsch schlägt dir der Lotsen-Check per KI eine Bewertung vor – die Entscheidung bleibt bei dir.',
    alt: 'Screenshot: Auswahl Richtig, Teilweise richtig, Falsch und darunter die Schaltfläche „Antwort vom Lotsen bewerten lassen“ mit dem Hinweis „Die KI schlägt dir eine Bewertung vor · 1 Token“ und einem KI-Band.',
    wide: false,
  },
  {
    src: '/screenshots/lernstand.png',
    width: 1776,
    height: 620,
    title: '4. Drei Lernmodi',
    text: 'Lerne nach Thema, im Fokus deiner Stern-Themen oder frische Fragen auf, die bald verblassen könnten – mit Überblick, wie viele noch frisch sind.',
    alt: 'Screenshot: Die Reiter Nach Thema, Fokus, Auffrischen und Probeprüfung. Der Bereich Auffrischen zeigt die Schaltfläche „Auffrischen starten“, einen Balken und die Zahlen zu möglicherweise verblassten, bald verblassenden und noch frischen Fragen.',
    wide: false,
  },
]

const EXAM_SCREENSHOTS = [
  {
    src: '/screenshots/pruefung-starten.png',
    width: 1392,
    height: 914,
    title: '1. Probeprüfung starten',
    text: 'Eine zufällige Probeprüfung wie im Fragebogen der echten Prüfung: 30 Fragen in maximal 90 Minuten, ohne Tipps. Frühere Prüfungen bleiben in der Übersicht.',
    alt: 'Screenshot: Die Probeprüfung mit den Regeln, der Schaltfläche „Probeprüfung starten“ und der Liste bisheriger Prüfungen mit Punkten und Ergebnis.',
    wide: false,
  },
  {
    src: '/screenshots/pruefung-ablegen.png',
    width: 1328,
    height: 908,
    title: '2. Fragebogen beantworten',
    text: 'Du beantwortest alle Fragen in eigenen Worten, mit Restzeit im Blick. Die Zeit wird serverseitig überwacht.',
    alt: 'Screenshot: Frage der Probeprüfung „Was bedeutet die Abkürzung GPS?“ mit ausgefülltem Antwortfeld, Fortschrittsanzeige „1 / 30“, verbleibender Zeit und den Schaltflächen Zurück, Übersicht und Weiter.',
    wide: false,
  },
  {
    src: '/screenshots/pruefung-ergebnis.png',
    width: 1344,
    height: 926,
    title: '3. Ergebnis und Auswertung',
    text: 'Danach schätzt du deine Antworten anhand der amtlichen Antworten selbst ein. Du siehst deine Punkte, das Ergebnis und die Auswertung nach Fach.',
    alt: 'Screenshot: Ergebnis der Probeprüfung mit 54 von 60 Punkten, „Bestanden“ und Balken je Fach für Navigation, Schifffahrtsrecht, Wetterkunde und Seemannschaft.',
    wide: false,
  },
]

const HERO_CTA = `lg:mt-10 ${buttonClass('secondary', { tone: 'dark' })}`

function ScreenshotList({ items, className }: { items: typeof SCREENSHOTS; className: string }) {
  return (
    <div className={`${className} flex flex-col gap-14`}>
      {items.map(({ src, width, height, title, text, alt, wide }) => (
        <figure
          key={src}
          className={`flex flex-col gap-4 ${wide ? '' : 'sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-8'}`}
        >
          <img
            src={src}
            width={width}
            height={height}
            alt={alt}
            loading="lazy"
            className="h-auto w-full border border-border sm:order-2"
          />
          <figcaption className="flex flex-col gap-1 sm:order-1">
            <span className="font-serif text-xl text-primary">{title}</span>
            <span className="text-sm leading-relaxed text-ink-soft">{text}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

// What guests do on the landing page (logged-in visitors would only blur it): which link they take
// (landing_link_clicked) and how far they read (landing_section_seen, once per band). Fixed keys
// only, ADR-0030.
function landingClick(track: boolean, target: LandingTarget) {
  return track ? () => trackLandingClick(target) : undefined
}

function TrackedSection({
  name,
  track,
  ...props
}: ComponentProps<'section'> & { name: LandingSection; track: boolean }) {
  const ref = useSectionSeen<HTMLElement>('landing_section_seen', name, track)
  return <section ref={ref} {...props} />
}

// What a Kartenaufgabe run is like (ADR-0052/0053): a screenshot of a run and what it offers. Ahead
// of the release, without a link; once the build's flag is "on", with one, since guests can then try
// them without a login (ADR-0056). (The WSV material's usage rights are cleared, so the screenshot
// may show it.)
const CHART_FEATURES = [
  [
    'Aufgabe für Aufgabe',
    'Die amtlichen Kartenaufgaben der WSV, eine Teilaufgabe nach der anderen – wie auf dem Prüfungsbogen, mit Punkten je Aufgabe.',
  ],
  [
    'Lösung mit Herleitung',
    'Nach deiner Antwort die amtliche Lösung mit Toleranz und auf Wunsch die Herleitung: Gezeitenrechnung, Kursumwandlung, Stromdreieck – Schritt für Schritt erklärt.',
  ],
  [
    'Formblatt am Bildschirm',
    'Das Formblatt Gezeiten zum Ausfüllen, der Originaltext der Aufgabe und deine bisherigen Antworten immer griffbereit.',
  ],
]

function ChartExercisesPreview({ track }: { track: boolean }) {
  const open = chartExercisesForGuests()
  return (
    <TrackedSection
      name="charts"
      track={track}
      aria-labelledby="kartenaufgaben"
      className="mt-20 rounded-tile border border-dashed border-primary p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <ChartDividersIcon className="size-8 text-primary" />
        <h3 id="kartenaufgaben" className="font-serif text-2xl text-primary">
          Kartenaufgaben
        </h3>
        <span className="rounded-tile bg-accent-strong px-2 py-0.5 font-mono text-xs tracking-wide text-surface uppercase">
          {open ? 'Neu' : 'Vorschau · bald verfügbar'}
        </span>
      </div>
      <p className="mt-3 max-w-xl text-sm text-ink-soft">
        Der zweite Teil der schriftlichen Prüfung: Navigationsaufgaben in der Übungskarte, 30 Punkte in 90 Minuten. SKS
        Lotse führt dich durch die amtlichen Aufgaben und ihre Lösungen.
      </p>
      <img
        src="/screenshots/kartenaufgabe.png"
        width={1456}
        height={772}
        alt="Screenshot: Kartenaufgabe 1, Aufgabe 1 von 18 – der Aufgabentext zu Hochwasser, Falldauer und Tidenfall in Cuxhaven, darunter die eigene Antwort und die amtliche Lösung mit „Herleitung anzeigen“, daneben das Formblatt Gezeiten zum Ausfüllen."
        loading="lazy"
        className="mt-8 h-auto w-full border border-border"
      />
      <Columns className="mt-8 sm:grid-cols-3">
        {CHART_FEATURES.map(([title, text]) => (
          <div key={title} className="flex flex-col gap-2">
            <h4 className="font-serif text-xl leading-snug text-primary">{title}</h4>
            <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
          </div>
        ))}
      </Columns>
      {open ? (
        <Link
          to="/charts"
          onClick={landingClick(track, 'charts')}
          className="mt-8 inline-block text-primary underline hover:no-underline"
        >
          Kartenaufgaben ausprobieren – auch ohne Anmeldung
        </Link>
      ) : null}
      <p className="mt-8 text-xs text-ink-soft">
        Rechnen und zeichnen tust du in deiner eigenen Seekarte: Übungskarte 49 (INT 1463), Karte 1/INT 1, Begleitheft
        und Navigationsbesteck gehören nicht zu SKS Lotse.
      </p>
    </TrackedSection>
  )
}

export function LandingPage() {
  useDocumentTitle(HOME_TITLE)
  // Logged-in visitors get the main nav (and the phone tab bar) and links into the app instead
  // of the sign-up form.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const track = !isAuthenticated
  const examRef = useSectionSeen<HTMLDivElement>('landing_section_seen', 'exam', track)

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {isAuthenticated ? <Header homeTo="/learn" nav={<MainNav />} /> : <Header />}

      <main className="flex-1">
        <HeroBand className="pt-14 pb-36 sm:pt-20 sm:pb-44">
          {/* What SKS Lotse promises beside one official question to try right away: the card is the
              page's first invitation, sign-up the second (ADR-0054). On a phone the card comes right
              after the promise, before the buttons, so it shows on the first screen. */}
          <div
            className={`${CONTENT} grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_auto] lg:gap-x-10 lg:gap-y-0`}
          >
            <div className="lg:self-end">
              <h1 className="font-serif text-3xl leading-tight break-words sm:text-5xl">
                Lerne die SKS-Theorie, bis du sie wirklich kannst
              </h1>
              <p className="mt-4 text-surface-alt sm:mt-6 sm:text-lg">
                Die SKS App mit allen Originalfragen des amtlichen Fragenkatalogs, online in eigenen Worten beantwortet
                wie in der Prüfung. Mit Konto merkt sich SKS Lotse, was du vergisst, und fragt es rechtzeitig wieder ab.
              </p>
            </div>
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
              <HeroSampleQuestion track={track} />
            </div>
            <div className="flex flex-col items-start lg:self-start">
              {isAuthenticated ? (
                <Link to="/learn" className={HERO_CTA}>
                  Jetzt loslegen
                </Link>
              ) : (
                <>
                  <a href="#anmelden" onClick={() => trackSignupClick('landing_hero')} className={HERO_CTA}>
                    Kostenloses Konto anlegen
                  </a>
                  <SignupBonusNote />
                  <Link
                    to="/learn"
                    onClick={landingClick(track, 'hero_guest')}
                    className="mt-5 text-sm text-surface-alt underline hover:text-surface"
                  >
                    Oder gleich ohne Anmeldung alle Fragen üben
                  </Link>
                </>
              )}
            </div>
          </div>
        </HeroBand>

        <TrackedSection name="features" track={track} className={`${CONTENT} py-16`}>
          <h2 className="sr-only">So funktioniert&apos;s</h2>
          <Columns>
            {[
              [
                'Originalfragen üben',
                'Online lernen mit allen Fragen aus dem amtlichen SKS-Fragenkatalog – wahlweise für „Segeln und Motor“ oder nur „Motor“, genau wie in der Theorieprüfung.',
              ],
              [
                'Mit der amtlichen Antwort vergleichen',
                'Überleg dir deine Antwort in eigenen Worten und vergleiche sie mit der amtlichen Antwort.',
              ],
              [
                'Selbst bewerten',
                'Richtig, teilweise richtig oder falsch: Mit Konto bestimmt deine Einschätzung, welche Fragen du wiederholst, bis du sie sicher kannst.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-6">
                <h3 className="font-serif text-2xl leading-snug text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
        </TrackedSection>

        <section className="bg-primary py-16 text-surface">
          <div className={CONTENT}>
            <h2 className="sr-only">Warum SKS Lotse?</h2>
            <Columns>
              {[
                ['Freitext', 'So wie in der echten Prüfung – kein Rätselraten zwischen vorgegebenen Antworten.'],
                [
                  'App ohne Store',
                  'Die SKS App läuft direkt im Browser auf Handy, Tablet oder Computer. Leg sie auf deinen Startbildschirm, dann öffnet sie sich wie eine App.',
                ],
                [
                  'Offener Katalog',
                  'Alle Fragen und amtlichen Antworten des Katalogs stehen offen – zum Üben auch ohne Anmeldung.',
                ],
              ].map(([title, text]) => (
                <div key={title} className="flex flex-col gap-6">
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="text-sm leading-relaxed text-surface-alt">{text}</p>
                </div>
              ))}
            </Columns>
          </div>
        </section>

        <TrackedSection name="app" track={track} className={`${CONTENT} py-16`}>
          <h2 className="font-serif text-3xl text-primary">Ein Blick in die App</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-soft">
            So sieht das Lernen in SKS Lotse aus – Screenshots aus der App.
          </p>
          <ScreenshotList items={SCREENSHOTS} className="mt-10" />

          <div ref={examRef}>
            <h3 className="mt-20 font-serif text-2xl text-primary">Probeprüfung</h3>
            <p className="mt-3 max-w-xl text-sm text-ink-soft">
              Der erste Teil der schriftlichen Prüfung unter realistischen Bedingungen: ein kompletter Fragebogen,
              danach Auswertung und Statistik in deinem Profil.
            </p>
            <ScreenshotList items={EXAM_SCREENSHOTS} className="mt-10" />
          </div>

          <ChartExercisesPreview track={track} />
        </TrackedSection>

        <TrackedSection name="catalog" track={track} className={`${CONTENT} py-16`}>
          <h2 className="font-serif text-3xl text-primary">Der amtliche SKS-Fragenkatalog</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Die theoretische SKS-Prüfung deckt vier Fächer ab: Navigation, Schifffahrtsrecht, Wetterkunde und
            Seemannschaft. Im echten Fragebogen sind sie mit 9, 7, 5 und 9 Fragen vertreten – zusammen 30 Fragen in 90
            Minuten, ohne Hilfsmittel. Zweiter Teil der schriftlichen Prüfung ist die Kartenaufgabe in der Übungskarte.
            SKS Lotse bildet den kompletten amtlichen Fragenkatalog ab, in beiden Prüfungsvarianten „Segeln und Motor“
            und „Motor“ – mit genau den Originalfragen und -musterantworten, die auch im Examen vorkommen, nicht mit
            umformulierten oder gekürzten Versionen.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link
              onClick={landingClick(track, 'catalog_learn')}
              to="/learn"
              className="text-primary underline hover:no-underline"
            >
              Alle Fragen nach Themen, frei zum Üben
            </Link>
            <Link
              onClick={landingClick(track, 'learning_method')}
              to="/learning-method"
              className="text-primary underline hover:no-underline"
            >
              Lernen wie mit Karteikarten: die Lernmethode
            </Link>
            <Link onClick={landingClick(track, 'faq')} to="/faq" className="text-primary underline hover:no-underline">
              Mehr zum Fragenkatalog in den häufigen Fragen
            </Link>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Du willst wissen, wie du dich Schritt für Schritt auf die SKS-Theorieprüfung vorbereitest und wie es nach
            der Theorie weitergeht?{' '}
            <Link
              onClick={landingClick(track, 'exam_process')}
              to="/exam-process"
              className="text-primary underline hover:no-underline"
            >
              So läuft die SKS-Prüfung ab
            </Link>
            .
          </p>
        </TrackedSection>

        <TrackedSection name="pricing" track={track} className="bg-primary-dark py-14 text-surface">
          <div className={`${CONTENT} grid gap-10 sm:grid-cols-2 sm:items-center`}>
            <div>
              <h2 className="font-serif text-3xl">Kostenlos starten</h2>
              <p className="mt-3 max-w-xl text-sm text-surface-alt">
                Die Grundfunktion bleibt dauerhaft kostenlos. Der Lotsen-Check läuft über Tokens (eines pro
                Katalogfrage, zwei je Aufgabe einer Kartenaufgabe, ohne Abo). Die aktuellen Preise stehen auf der Seite{' '}
                <Link to="/pricing" onClick={landingClick(track, 'pricing')} className="underline hover:text-surface">
                  Preise
                </Link>
                .
              </p>
            </div>
            <ShareLinks />
          </div>
        </TrackedSection>

        <TrackedSection name="faq" track={track} className={`${CONTENT} py-16`}>
          <h2 className="font-serif text-3xl text-primary">Häufige Fragen</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-soft">Ein paar Antworten auf Fragen, die uns oft erreichen.</p>
          <div className="mt-10 flex flex-col gap-8">
            {LANDING_FAQ.map(({ id, question, answer }) => (
              <div key={id} className="flex flex-col gap-2">
                <h3 className="font-serif text-xl text-primary">
                  <Link to={`/faq#${id}`} onClick={landingClick(track, 'faq_entry')} className="hover:underline">
                    {question}
                  </Link>
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  <FaqAnswer answer={answer} linkClassName="underline hover:text-primary" />
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/faq"
            onClick={landingClick(track, 'faq_all')}
            className="mt-8 inline-block font-mono text-sm tracking-wide text-primary uppercase hover:underline"
          >
            Alle Fragen ansehen →
          </Link>
        </TrackedSection>

        <TrackedSection name="signup" track={track} id="anmelden" className="scroll-mt-4 bg-primary py-16 text-surface">
          <div className={`${CONTENT} grid gap-10 sm:grid-cols-2`}>
            <div className="flex flex-col gap-4">
              <h2 className="font-serif text-3xl">Jetzt loslegen</h2>
              <dl className="flex flex-col gap-3 text-sm text-surface-alt">
                {[
                  ['Ohne Anmeldung', 'alle Fragen frei üben, ohne Lernstand'],
                  ['Anmeldung', 'per Login-Code, ohne Passwort'],
                  ['Fortschritt', 'wird in deinem Konto gespeichert'],
                  ['Kosten', 'kostenlos, Erweiterungen optional'],
                ].map(([term, detail]) => (
                  <div key={term}>
                    <dt className="inline text-surface">{term}: </dt>
                    <dd className="inline">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {isAuthenticated ? (
              <div className="flex flex-col justify-center gap-4">
                <p className="text-sm text-surface-alt">Du bist bereits angemeldet.</p>
                <Link to="/learn" className={buttonClass('primary', { tone: 'dark' })}>
                  Zum Lernen
                </Link>
              </div>
            ) : (
              <LoginForm tone="dark" />
            )}
          </div>
        </TrackedSection>
      </main>

      <LegalFooter />
      {isAuthenticated ? <MobileTabBar /> : null}
    </div>
  )
}
