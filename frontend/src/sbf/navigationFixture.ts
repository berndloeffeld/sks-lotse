import type { NavigationExport, NavigationTask } from './navigationCatalog'

function original(task: number, subtask: number) {
  const image = (part: string) => ({ src: `aufgabe-0${task}-${subtask}-${part}.png`, width: 600, height: 120 })
  return { question: image('aufgabe'), result: image('ergebnis') }
}

// Test data in the export's shape: two tasks of three subtasks, passed from two points.
export function navigationTaskFixture(number = 1): NavigationTask {
  return {
    number,
    situation: [`Ein Sportboot passiert um 10:00 Uhr die Tonne "TG${number}".`, 'Die Fahrt über Grund beträgt 8 kn.'],
    subtasks: [
      {
        number: 1,
        text: 'Wie lautet der rwK?',
        result: 'rwK = 079°',
        own_tolerance: '±1°',
        original: original(number, 1),
      },
      {
        number: 2,
        text: 'Wie lautet der MgK?',
        result: 'MgK = 074° *)',
        own_tolerance: '±1°',
        original: original(number, 2),
      },
      {
        number: 3,
        text: 'Tragen Sie den Kurs ein.',
        result: 'Siehe Karte',
        own_tolerance: null,
        original: original(number, 3),
      },
    ],
    footnotes: ['*) Der MgK lautet tatsächlich: 074°'],
  }
}

export function navigationExportFixture(): NavigationExport {
  return {
    source: 'WSV, Fragenkatalog See, www.elwis.de',
    chart_notice: 'Den Navigationsaufgaben liegt die Übungskarte D49 zugrunde.',
    sections_notice: 'Die Navigationsaufgaben sind anhand folgender Kartenausschnitte zu bearbeiten:',
    chart_sections: [{ number: 1, corners: ["N53°46,06', E007°43,12'", "N54°00,42', E008°00,00'"] }],
    pool_notice: 'Aus den nachfolgenden 15 Fragen werden jeweils 9 Fragen ausgewählt.',
    pool: [{ number: 286, text: 'Wie lautet der rwK?' }],
    aids: ['Bei der Navigationsaufgabe sind als Hilfsmittel ein Navigationsdreieck erlaubt.'],
    pass_points: 2,
    scoring: ['1 Punkt je richtiger Antwort.'],
    typo_fixes: [{ task: 1, subtask: 1, field: 'result', official: 'rwk = 079°', corrected: 'rwK = 079°' }],
    tasks: [navigationTaskFixture(1), navigationTaskFixture(2)],
  }
}
