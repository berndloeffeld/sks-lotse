import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { trackSignupClick } from '../../shared/analytics'
import { LEARNING_METHOD_FAQ } from '../faq'
import { FlashcardBoxFigure, ForgettingCurveFigure, GradeEffectFigure } from '../components/LearningMethodFigures'
import { PageLayout } from '../components/PageLayout'
import { ProseSection } from '../../shared/components/ProseSection'
import { buttonClass } from '../../shared/components/buttonStyles'
import { subsectionHeading } from '../../shared/components/headingStyles'
import { useAuthStore } from '../../shared/store/authStore'

const LINK = 'text-primary underline hover:no-underline'
const LIST = 'flex list-disc flex-col gap-2 pl-5'

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <strong className="text-ink">{title}</strong> {children}
    </li>
  )
}

// Explains the learning system (ADR-0034) in the learners' words, for people searching how to
// learn the catalog. Deliberately without the model's numbers: the rule isn't meant to be
// readable at a glance (ADR-0024).
export function LearningMethodPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return (
    <PageLayout title="SKS-Fragenkatalog lernen mit dem Karteikarten-Prinzip" nav="public">
      <ProseSection id="warum" title="Warum einmal Durchlesen nicht reicht">
        <p>
          Der amtliche SKS-Fragenkatalog ist groß, und seine Fragen sind Freitext: In der Prüfung erkennst du keine
          Antwort wieder, du formulierst sie selbst. Was du dir einmal angesehen hast, ist nach wenigen Tagen zu einem
          großen Teil wieder weg – das ist die bekannte Vergessenskurve. Wer kurz vor der Prüfung alles auf einmal
          paukt, kennt vieles nur für den Moment.
        </p>
        <p>
          Dagegen hilft Wiederholen, aber im richtigen Abstand: Frisch Gelerntes brauchst du bald wieder, Sicheres erst
          nach längerer Zeit. Genau das machen Karteikarten.
        </p>
        <ForgettingCurveFigure />
      </ProseSection>

      <ProseSection id="karteikarten" title="Das Karteikarten-Prinzip">
        <p>
          Bei einer klassischen Lernkartei wandert eine Karte, die du gewusst hast, in ein Fach, das du seltener
          durchgehst. Eine Karte, die du nicht wusstest, kommt nach vorn zurück. So verbringst du deine Zeit mit dem,
          was noch wackelt, statt mit dem, was schon sitzt.
        </p>
        <FlashcardBoxFigure />
        <p>
          SKS Lotse übernimmt die Buchführung dafür, für jede Frage des Katalogs – ohne Kasten, Fächer und Zettel. Statt
          fester Fächer schätzt es für jede Frage, wie lange du sie voraussichtlich noch weißt.
        </p>
      </ProseSection>

      <ProseSection id="ablauf" title="So läuft eine Frage ab">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Du liest die Frage und formulierst deine Antwort in eigenen Worten, im Kopf oder aufgeschrieben.</li>
          <li>Du deckst die amtliche Antwort auf und vergleichst.</li>
          <li>
            Du bewertest dich selbst: <em>Richtig</em>, <em>Teilweise richtig</em> oder <em>Falsch</em>. Unsicher? Der
            Lotsen-Check schlägt eine Bewertung vor; die Entscheidung bleibt bei dir.
          </li>
          <li>SKS Lotse passt für diese Frage an, wie lange du sie voraussichtlich behältst.</li>
        </ol>
      </ProseSection>

      <ProseSection id="halbwertszeit" title="Die Halbwertszeit deiner Antworten">
        <p>
          Dahinter steckt eine einfache Idee aus der Gedächtnisforschung: Jede Antwort verblasst mit der Zeit, anfangs
          schnell, dann langsamer. Die <strong className="text-ink">Halbwertszeit</strong> sagt, nach welcher Zeit du
          ungefähr nur noch die Hälfte davon weißt. Sprachlern-Apps rechnen ähnlich. SKS Lotse schätzt für jede Frage
          eine solche Halbwertszeit und passt sie nach jeder Bewertung an:
        </p>
        <ul className={LIST}>
          <Item title="Richtig:">die Frage bleibt dir voraussichtlich länger erhalten.</Item>
          <Item title="Teilweise richtig:">die geschätzte Zeit sinkt deutlich.</Item>
          <Item title="Falsch:">sie sinkt stark, die Frage kommt bald wieder.</Item>
        </ul>
        <GradeEffectFigure />
        <p>
          Der Abstand zählt: Beantwortest du eine Frage richtig, kurz nachdem du sie schon richtig hattest, bringt das
          fast nichts – dein Gedächtnis war ja noch frisch. Richtig nach einer Pause zeigt dagegen, dass die Antwort
          wirklich hängen geblieben ist, und zählt entsprechend mehr. Deshalb lohnt es sich, an mehreren Tagen kurz zu
          lernen, statt an einem Tag lange.
        </p>
      </ProseSection>

      <ProseSection id="gelernt" title="Wann eine Frage als gelernt gilt">
        <p>
          Nicht schon nach einmal „Richtig“. Eine Frage gilt als gelernt, wenn du sie über mehrere Tage verteilt gut
          beantwortet hast und SKS Lotse davon ausgeht, dass du sie noch weißt. Läuft die geschätzte Zeit ab, ohne dass
          du wiederholt hast, gilt die Frage wieder als offen und kommt in der Übung zurück.
        </p>
        <p>
          Dein Lernstand kann deshalb auch sinken, wenn du länger pausierst. Das ist gewollt: Er soll ein ehrlicher
          Hinweis darauf sein, wie prüfungsreif du bist, und nicht anzeigen, was du irgendwann einmal gewusst hast. Die
          genauen Werte zeigen wir bewusst nicht – du sollst auf die Inhalte hinarbeiten, nicht auf eine Zahl.
        </p>
      </ProseSection>

      <ProseSection id="wege" title="Drei Wege durch den Katalog">
        <ul className={LIST}>
          <Item title="Nach Thema:">
            der Katalog Thema für Thema, so wie er amtlich gegliedert ist. Auch ohne Anmeldung möglich.
          </Item>
          <Item title="Fokus:">deine Stern-Themen; was du am längsten nicht richtig hattest, kommt zuerst.</Item>
          <Item title="Auffrischen:">
            bis zu 20 Fragen, die du schon sicher konntest und die verblasst sind oder bald verblassen.
          </Item>
        </ul>
        <p>
          Alle drei findest du unter{' '}
          <Link to="/learn" className={LINK}>
            Lernen
          </Link>
          . Ohne Anmeldung kannst du jedes Thema üben und dich bewerten, es wird aber nichts gespeichert. Mit
          kostenlosem Konto merkt sich SKS Lotse deinen Lernstand auf jedem Gerät und zählt auch die Probeprüfung mit,
          wenn du möchtest.
        </p>
      </ProseSection>

      <ProseSection id="tipps" title="So holst du das Meiste heraus">
        <ul className={LIST}>
          <Item title="Lieber oft und kurz als selten und lang.">
            Eine halbe Stunde an mehreren Tagen der Woche schlägt in der Regel einen Marathon am Wochenende.
          </Item>
          <Item title="Antworte, bevor du nachsiehst.">
            Aufdecken und Nicken ist leichter als Abrufen – und in der Prüfung musst du abrufen. Schreib die Antwort
            wirklich auf oder sprich sie laut aus.
          </Item>
          <Item title="Bewerte dich ehrlich.">
            „Teilweise richtig“ ist keine Niederlage, sondern sorgt dafür, dass die Frage rechtzeitig wiederkommt. Wer
            sich zu großzügig bewertet, täuscht vor allem seinen eigenen Lernstand.
          </Item>
          <Item title="Fang früh an.">
            Ein Lernstand, der auf Wiederholung über Tage beruht, lässt sich nicht in der letzten Nacht aufbauen.
            Beginne einige Wochen vor dem Prüfungstermin.
          </Item>
          <Item title="Probe zum Schluss.">
            Wenn die Fragen sitzen, zeigt dir die Probeprüfung mit 30 Fragen in 90 Minuten, wie du unter Zeitdruck
            abschneidest. Mehr zur Prüfung selbst:{' '}
            <Link to="/exam-process" className={LINK}>
              So läuft die SKS-Prüfung ab
            </Link>
            .
          </Item>
        </ul>
      </ProseSection>

      <ProseSection id="grenzen" title="Ehrlich gesagt: eine Schätzung">
        <p>
          Die Halbwertszeit einer Frage ist eine begründete Schätzung, kein gemessener Wert. SKS Lotse rechnet nach dem
          Vorbild von Karteikarten- und Sprachlern-Systemen mit festen Faktoren, die nicht an Prüfungsdaten trainiert
          sind. Ein hoher Lernstand ist deshalb keine Garantie fürs Bestehen. Er hilft dir aber, deine Übungszeit auf
          das zu lenken, was noch wackelt.
        </p>
      </ProseSection>

      <ProseSection id="kurz-beantwortet" title="Kurz beantwortet">
        {LEARNING_METHOD_FAQ.map(({ question, answer }) => (
          <div key={question} className="flex flex-col gap-1">
            <h3 className={subsectionHeading}>{question}</h3>
            <p>{answer}</p>
          </div>
        ))}
      </ProseSection>

      <ProseSection id="loslegen" title="Mit dem Lernen anfangen">
        <p>
          Alle Fragen des amtlichen Katalogs stehen frei zum Üben. Mit einem kostenlosen Konto behält SKS Lotse für dich
          im Blick, was sitzt und was wiederkommt. Weitere Antworten stehen in den{' '}
          <Link to="/faq" className={LINK}>
            häufigen Fragen
          </Link>
          .
        </p>
        <div className="pt-2">
          {/* A guest signs up and goes on to /learn (the login's default target), not back to this page;
              a learner goes there directly. */}
          <Link
            to={isAuthenticated ? '/learn' : '/login'}
            className={buttonClass('primary')}
            onClick={isAuthenticated ? undefined : () => trackSignupClick('learning_method')}
          >
            {isAuthenticated ? 'Zum Lernen' : 'Kostenlos anmelden'}
          </Link>
        </div>
      </ProseSection>
    </PageLayout>
  )
}
