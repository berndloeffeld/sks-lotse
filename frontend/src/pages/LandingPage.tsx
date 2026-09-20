import { Link } from 'react-router-dom'

import { AccountNav } from '../components/AccountNav'
import { BAND_CONTENT as CONTENT, Columns } from '../components/Bands'
import { ContourBackground } from '../components/ContourBackground'
import { Header } from '../components/Header'
import { HeroBand } from '../components/HeroBand'
import { AnswerIcon, CatalogIcon, FeedbackIcon } from '../components/icons/FeatureIcons'
import { LegalFooter } from '../components/LegalFooter'
import { LoginForm } from '../components/LoginForm'
import { useAuthStore } from '../store/authStore'

// Banded layout after a website template: full-width color bands (light
// bg / primary / primary-dark) alternating down the page, a slanted hero
// edge, three-column text blocks, image-topped cards and a sign-up form
// band. Palette, type and square-cornered chrome stay per ADR-0014.

const PLANS = [
  {
    kicker: 'Standard',
    title: 'Musterantwort',
    icon: <CatalogIcon className="h-16 w-16" />,
    text: 'Fragen üben und die amtliche Musterantwort direkt zum Vergleich sehen – mit Werbung finanziert.',
  },
  {
    kicker: 'Erweiterung · demnächst',
    title: 'KI-Bewertung',
    icon: <AnswerIcon className="h-16 w-16" />,
    text: 'Schreib oder sprich deine Antwort und erhalte eine Bewertung mit Erklärung, was gefehlt hat.',
  },
  {
    kicker: 'Erweiterung · demnächst',
    title: 'Werbefrei',
    icon: <FeedbackIcon className="h-16 w-16" />,
    text: 'Lernen ganz ohne Anzeigen – ruhig und konzentriert.',
  },
]

// Real screenshots of the running app (public/screenshots), cropped to the
// content column; the demo account's data is made up.
const SCREENSHOTS = [
  {
    src: '/screenshots/frage-beantworten.png',
    width: 1050,
    height: 566,
    title: '1. Frage beantworten',
    text: 'Eine Frage aus dem Katalog, dazu ein optionales Notizfeld für deine Antwort – sie wird nicht gespeichert.',
    alt: 'Screenshot: Die Frage „Welchen Kurs zeigen GPS-Geräte an?“ mit ausgefülltem Antwortfeld und der Schaltfläche „Lösung anzeigen“.',
    wide: false,
  },
  {
    src: '/screenshots/selbst-bewerten.png',
    width: 1050,
    height: 779,
    title: '2. Vergleichen und bewerten',
    text: 'Neben deiner Antwort steht die amtliche Musterantwort. Du bewertest selbst: richtig, teilweise richtig oder falsch.',
    alt: 'Screenshot: Deine Antwort neben der amtlichen Antwort „Den Kurs über Grund (KüG)“, darunter die Auswahl Richtig, Teilweise Richtig, Falsch.',
    wide: false,
  },
  {
    src: '/screenshots/lernstand.png',
    width: 1344,
    height: 1274,
    title: '3. Lernstand und Fokus',
    text: 'Gesamtfortschritt und Verteilung nach Fachgebieten. Markiere Themen als Fokus und sieh, wie viele Fragen du sicher oder teilweise gelernt hast.',
    alt: 'Screenshot: Übersicht Lernen mit Gesamtfortschritt in Prozent, einem Kreisdiagramm der Fachgebiete, der Auswahl der Prüfungsvariante und dem Fokus-Bereich mit drei markierten Themen und ihrem Lernstand.',
    wide: true,
  },
]

const EXAM_SCREENSHOTS = [
  {
    src: '/screenshots/pruefung-starten.png',
    width: 700,
    height: 390,
    title: '1. Prüfung starten',
    text: 'Eine zufällige Prüfung wie im Fragebogen der echten Prüfung: 30 Fragen in maximal 90 Minuten, ohne Tipps. Frühere Prüfungen bleiben in der Übersicht.',
    alt: 'Screenshot: Die Prüfungssimulation mit den Regeln, der Schaltfläche „Prüfung starten“ und der Liste bisheriger Prüfungen mit Punkten und Ergebnis.',
    wide: false,
  },
  {
    src: '/screenshots/pruefung-ablegen.png',
    width: 700,
    height: 335,
    title: '2. Fragebogen beantworten',
    text: 'Du beantwortest alle Fragen in eigenen Worten, mit Restzeit im Blick. Die Zeit wird serverseitig überwacht.',
    alt: 'Screenshot: Prüfungsfrage „Was bedeutet die Abkürzung GPS?“ mit ausgefülltem Antwortfeld, Fortschrittsanzeige und Restzeit.',
    wide: false,
  },
  {
    src: '/screenshots/pruefung-ergebnis.png',
    width: 700,
    height: 440,
    title: '3. Ergebnis und Auswertung',
    text: 'Danach schätzt du deine Antworten anhand der amtlichen Antworten selbst ein. Du siehst deine Punkte, das Ergebnis und die Auswertung nach Fachgebiet.',
    alt: 'Screenshot: Prüfungsergebnis mit 54 von 60 Punkten, „Bestanden“ und Balken je Fachgebiet für Navigation, Schifffahrtsrecht, Wetterkunde und Seemannschaft.',
    wide: false,
  },
]

const HERO_CTA =
  'mt-10 rounded-tile border-2 border-surface px-6 py-3 font-mono text-sm tracking-wide uppercase transition hover:bg-surface hover:text-primary-dark'

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

export function LandingPage() {
  // Logged-in visitors get the account nav and links into the app instead
  // of the sign-up form.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {isAuthenticated ? <Header homeTo="/start" nav={<AccountNav />} /> : <Header />}

      <main className="flex-1">
        <HeroBand className="pt-20 pb-36 text-center sm:pb-44">
          <div className={`flex flex-col items-center ${CONTENT} max-w-2xl`}>
            <h1 className="font-serif text-4xl tracking-wide break-words uppercase sm:text-5xl">
              Sicher durch die SKS-Theorie
            </h1>
            <p className="mt-8 text-lg tracking-wide text-surface-alt uppercase sm:text-xl">
              Online für die SKS-Theorieprüfung lernen – mit den Originalfragen des amtlichen Katalogs
            </p>
            <p className="mt-6 text-sm text-surface-alt">
              Beta-Version: SKS Lotse wird gerade aufgebaut – KI-Bewertung und Spracheingabe folgen.
            </p>
            {isAuthenticated ? (
              <Link to="/start" className={HERO_CTA}>
                Jetzt loslegen
              </Link>
            ) : (
              <a href="#anmelden" className={HERO_CTA}>
                Jetzt loslegen
              </a>
            )}
          </div>
        </HeroBand>

        <section className={`${CONTENT} py-16`}>
          <h2 className="sr-only">So funktioniert&apos;s</h2>
          <Columns>
            {[
              [
                'Originalfragen üben',
                'Online lernen mit allen Fragen aus dem amtlichen SKS-Fragenkatalog – wahlweise für „Segeln und Motor" oder nur „Motor", genau wie in der Theorieprüfung.',
              ],
              [
                'Mit der Musterantwort vergleichen',
                'Überleg dir deine Antwort in eigenen Worten und vergleiche sie mit der amtlichen Musterantwort.',
              ],
              [
                'Selbst bewerten',
                'Richtig, teilweise richtig oder falsch: Deine Einschätzung bestimmt, welche Fragen du wiederholst, bis du sie sicher kannst.',
              ],
            ].map(([title, text]) => (
              <div key={title} className="flex flex-col gap-6">
                <h3 className="font-serif text-2xl leading-snug text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
        </section>

        <section className="bg-primary py-16 text-surface">
          <div className={CONTENT}>
            <h2 className="sr-only">Warum SKS Lotse?</h2>
            <Columns>
              {[
                ['Freitext', 'So wie in der echten Prüfung – kein Rätselraten zwischen vorgegebenen Antworten.'],
                ['Ohne App', 'Läuft direkt im Browser, auf Handy, Tablet oder Desktop – kein Store-Download.'],
                ['Offener Katalog', 'Der amtliche Fragenkatalog und die Musterantworten stehen von Anfang an offen.'],
              ].map(([title, text]) => (
                <div key={title} className="flex flex-col gap-6">
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="text-sm leading-relaxed text-surface-alt">{text}</p>
                </div>
              ))}
            </Columns>
          </div>
        </section>

        <section className={`${CONTENT} py-16`}>
          <h2 className="font-serif text-3xl text-primary">Ein Blick in die App</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-soft">
            So sieht das Lernen in SKS Lotse aus – Screenshots der Beta-Version.
          </p>
          <ScreenshotList items={SCREENSHOTS} className="mt-10" />

          <h3 className="mt-20 font-serif text-2xl text-primary">Prüfungssimulation</h3>
          <p className="mt-3 max-w-xl text-sm text-ink-soft">
            Teste dich unter realistischen Bedingungen: ein kompletter Fragebogen, danach Auswertung und Statistik in
            deinem Profil.
          </p>
          <ScreenshotList items={EXAM_SCREENSHOTS} className="mt-10" />
        </section>

        <section className="bg-primary-dark py-14 text-surface">
          <div className={CONTENT}>
            <h2 className="font-serif text-3xl">Kostenlos starten</h2>
            <p className="mt-3 max-w-xl text-sm text-surface-alt">
              Zwei unabhängige Erweiterungen lassen sich später einzeln freischalten – Preise folgen in Kürze.
            </p>
          </div>
        </section>

        <section className={`${CONTENT} py-16`}>
          <Columns>
            {PLANS.map(({ kicker, title, icon, text }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-surface-alt text-primary">
                  <ContourBackground className="h-full" />
                  <div className="relative">{icon}</div>
                </div>
                <span className="mt-2 font-mono text-xs tracking-wide text-ink-soft uppercase">{kicker}</span>
                <h3 className="font-serif text-2xl text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            ))}
          </Columns>
        </section>

        <section id="anmelden" className="scroll-mt-4 bg-primary py-16 text-surface">
          <div className={`${CONTENT} grid gap-10 sm:grid-cols-2`}>
            <div className="flex flex-col gap-4">
              <h2 className="font-serif text-3xl">Jetzt loslegen</h2>
              <dl className="flex flex-col gap-3 text-sm text-surface-alt">
                {[
                  ['Anmeldung', 'per E-Mail-Code, ohne Passwort'],
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
                <Link
                  to="/start"
                  className="rounded-tile bg-accent px-4 py-3 text-center font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink"
                >
                  Zur Übersicht
                </Link>
              </div>
            ) : (
              <LoginForm tone="dark" />
            )}
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  )
}
