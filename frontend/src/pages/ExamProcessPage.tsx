import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { chartExercisesForGuests } from '../chartCatalog'
import { EXAM_PROCESS_FAQ } from '../faq'
import { PageLayout } from '../components/PageLayout'
import { BoatIcon, CatalogIcon, CertificateIcon, ChartDividersIcon } from '../components/icons/FeatureIcons'
import { useAuthStore } from '../store/authStore'
import { buttonClass } from '../components/buttonStyles'
import { sectionHeading, subsectionHeading } from '../components/headingStyles'

interface SectionProps {
  icon?: ReactNode
  title: string
  children: ReactNode
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="text-primary" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h2 className={sectionHeading}>{title}</h2>
      </div>
      <div className="flex flex-col gap-3 text-ink-soft">{children}</div>
    </section>
  )
}

export function ExamProcessPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return (
    <PageLayout title="So läuft die SKS-Prüfung ab" nav="public">
      <Section title="Der Weg zum Sportküstenschifferschein auf einen Blick">
        <p>
          Der Sportküstenschifferschein (SKS) berechtigt zum Führen von Segel- und Motoryachten in Küstengewässern. Der
          Weg dahin führt über drei Stationen: den bereits vorhandenen Sportbootführerschein See (SBF See), die
          SKS-Theorieprüfung und die SKS-Praxisprüfung. Theorie und Praxis kannst du in beliebiger Reihenfolge ablegen,
          musst beide aber innerhalb von 24 Monaten abschließen.
        </p>
      </Section>

      <Section icon={<CertificateIcon className="h-8 w-8" />} title="Was du vor der SKS-Prüfung schon mitbringen musst">
        <p>
          Ohne den Sportbootführerschein See (SBF See) geht es nicht – er ist Voraussetzung für die Zulassung zur SKS.
          Außerdem verlangt die Prüfungsordnung 300 Seemeilen Erfahrung auf Yachten in Küstengewässern, bevor du zur
          praktischen SKS-Prüfung antreten kannst. Diese Meilen sammelst du typischerweise auf Törns oder bei einer
          Segelschule, während du parallel für die Theorie lernst.
        </p>
      </Section>

      <Section icon={<CatalogIcon className="h-8 w-8" />} title="So läuft die SKS-Theorieprüfung ab">
        <p>
          Die Theorieprüfung besteht aus einem Fragebogen mit 30 Fragen in 90 Minuten, aufgeteilt auf Navigation (9),
          Schifffahrtsrecht (7), Wetterkunde (5) und Seemannschaft (9).
        </p>
        <p>
          SKS Lotse bereitet dich mit dem kompletten amtlichen Fragenkatalog auf genau diesen Fragebogen vor – mit
          Originalfragen und amtlichen Antworten.
        </p>
      </Section>

      <Section icon={<ChartDividersIcon className="h-8 w-8" />} title="Die Karten- und Gezeitenaufgabe">
        <p>
          Zusätzlich zum Fragebogen gehört eine separate Karten- und Gezeitenaufgabe zur Theorieprüfung: Auf einer
          Seekarte bestimmst du mit Kursdreieck und Zirkel Kurse, Distanzen und Gezeitenzeiten – in weiteren 90 Minuten,
          getrennt vom Fragebogen bewertet.
        </p>
        {chartExercisesForGuests() ? (
          <p>
            Bei SKS Lotse übst du die amtlichen{' '}
            <Link to="/charts" className="text-primary underline hover:no-underline">
              Kartenaufgaben
            </Link>{' '}
            der WSV Aufgabe für Aufgabe, mit amtlicher Lösung und Herleitung – kostenlos, auch ohne Anmeldung. Die
            Handhabung von Kursdreieck und Zirkel übst du zusätzlich am besten mit einer echten Seekarte, zum Beispiel
            im Vorbereitungskurs einer Segelschule.
          </p>
        ) : (
          <p>
            SKS Lotse hilft dir dabei bisher nicht – die Kartenaufgabe übst du am besten mit einer echten Seekarte, zum
            Beispiel im Vorbereitungskurs einer Segelschule oder bei Online-Kursen.
          </p>
        )}
      </Section>

      <Section icon={<BoatIcon className="h-8 w-8" />} title="So läuft die SKS-Praxisprüfung ab">
        <p>
          Bei der praktischen Prüfung zeigst du auf einer Segelyacht in Küstengewässern, dass du Manöver, Navigation und
          Seemannschaft sicher beherrschst. Sie dauert maximal 30 Minuten pro Prüfling.
        </p>
        <p>
          SKS Lotse deckt ausschließlich die Theorie ab – die praktische Ausbildung und Prüfung holst du dir bei einer
          Segelschule oder einem erfahrenen Skipper.
        </p>
      </Section>

      <Section title="Warum sich der SKS lohnt">
        <p>
          Für private Skipper ist der SKS gesetzlich nicht vorgeschrieben – außerhalb der SBF-See-pflichtigen Zone
          brauchst du zum Fahren an sich keinen Schein. Vorgeschrieben ist er nur für die gewerbliche Nutzung von
          Sportbooten in Küstengewässern.
        </p>
        <p>
          Willst du privat eine Segelyacht chartern, kommst du trotzdem kaum an ihm vorbei: Viele Vercharterer verlangen
          den SKS als Befähigungsnachweis, bevor sie dir eine Yacht anvertrauen.
        </p>
      </Section>

      <Section title="Kurz beantwortet">
        {EXAM_PROCESS_FAQ.map(({ question, answer }) => (
          <div key={question} className="flex flex-col gap-1">
            <h3 className={subsectionHeading}>{question}</h3>
            <p>{answer}</p>
          </div>
        ))}
      </Section>

      <Section icon={<CatalogIcon className="h-8 w-8" />} title="Auf die SKS-Theorieprüfung vorbereiten mit SKS Lotse">
        <p>
          SKS Lotse deckt den kompletten amtlichen Fragenkatalog für die SKS-Theorieprüfung ab – mit Originalfragen,
          amtlichen Antworten und einer Probeprüfung unter realistischen Bedingungen. Leg direkt los und lerne kostenlos
          für deine Theorieprüfung.
        </p>
        <div className="pt-2">
          {/* A guest signs up and goes on to /learn (the login's default target), not back to this page;
              a learner goes there directly. */}
          <Link to={isAuthenticated ? '/learn' : '/login'} className={buttonClass('primary')}>
            {isAuthenticated ? 'Zum Lernen' : 'Kostenlos anmelden'}
          </Link>
        </div>
      </Section>
    </PageLayout>
  )
}
