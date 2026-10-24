// The logged-in navigation's areas: the header links on wide screens, the tab bar on phones.
//
// With the Kartenaufgaben the app follows the written exam's two parts: "Fragen" (learning the
// catalog and the Probeprüfung, i.e. the Fragebogen; the Probeprüfung is a tab of /learn there,
// LearnModes) and "Kartenaufgaben". Without them it stays at Lernen and Prüfung side by side.

export type NavIcon = 'catalog' | 'exam' | 'charts'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  // Path prefixes that count as this item (the item's own path and its sub-pages).
  prefixes: string[]
}

const LEARN: NavItem = { to: '/learn', label: 'Lernen', icon: 'catalog', prefixes: ['/learn'] }
const EXAM: NavItem = { to: '/exam', label: 'Probeprüfung', icon: 'exam', prefixes: ['/exam'] }

const QUESTIONS: NavItem = { to: '/learn', label: 'Fragen', icon: 'catalog', prefixes: ['/learn', '/exam'] }
const CHARTS: NavItem = { to: '/charts', label: 'Kartenaufgaben', icon: 'charts', prefixes: ['/charts'] }

export function mainNavItems(chartExercises: boolean): NavItem[] {
  return chartExercises ? [QUESTIONS, CHARTS] : [LEARN, EXAM]
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

// The tabs of /learn. The Probeprüfung joins them as a fourth with the Kartenaufgaben, where /learn
// is the whole Fragen area; without them it is a page of its own.
export type LearnMode = 'topic' | 'focus' | 'refresh' | 'exam'

export function learnModes(withExam: boolean): LearnMode[] {
  return withExam ? ['topic', 'focus', 'refresh', 'exam'] : ['topic', 'focus', 'refresh']
}
