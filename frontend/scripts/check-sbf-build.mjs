// After an SBF build (VITE_SITE=sbf, ADR-0067), checks dist/ holds SBF Lotse and nothing of SKS
// Lotse's app: none of SKS Lotse's pages (they call API routes only SKS Lotse has, the admin area
// among them), none of its data chunks, and no call to SKS Lotse's API host — sbf-lotse.de has its own
// (ADR-0070). And the Navigationsaufgaben (ADR-0068) exactly as VITE_SBF says: with "on" their data
// chunk and originals, with "off" neither, nor their pages. Run by frontend-ci.yml after
// `npm run build` with the same env; exits non-zero on a finding.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assets = readdirSync(`${dist}assets`)
const scripts = assets.filter((name) => name.endsWith('.js'))
const problems = []

if (!readFileSync(`${dist}index.html`, 'utf8').includes('data-site="sbf"')) {
  problems.push('dist/index.html is not the SBF page (index.sbf.html)')
}
// API routes only SKS Lotse's pages call: one of them in the bundle means an SKS page came along.
const SKS_ONLY_ROUTES = ['/admin/', '/chart-exercises', '/exams', '/progress/', '/questions']
for (const name of scripts) {
  const code = readFileSync(`${dist}assets/${name}`, 'utf8')
  for (const route of SKS_ONLY_ROUTES) {
    if (code.includes(`'${route}`) || code.includes(`"${route}`) || code.includes(`\`${route}`)) {
      problems.push(`assets/${name} calls SKS Lotse's API route ${route}`)
    }
  }
  // The full origin: the shared Datenschutzerklärung names both API hosts in its text.
  if (code.includes('https://api.sks-lotse.de')) problems.push(`assets/${name} calls SKS Lotse's API host`)
}
for (const chunk of ['catalog.gen', 'chart_exercises.gen', 'landing_samples.gen']) {
  if (assets.some((name) => name.startsWith(`${chunk}-`))) problems.push(`SKS Lotse's ${chunk} chunk is in the build`)
}

const open = process.env.VITE_SBF === 'on'
const built = {
  'the Navigationsaufgaben data chunk': assets.some((name) => name.startsWith('sbf_navigation.gen-')),
  'the originals (navigation/originals/)': existsSync(`${dist}navigation/originals`),
  'the /navigation page': existsSync(`${dist}navigation.html`),
}
for (const [what, there] of Object.entries(built)) {
  if (there !== open)
    problems.push(`${what} ${there ? 'is in' : 'is missing from'} a build with VITE_SBF=${open ? 'on' : 'off'}`)
}

if (problems.length > 0) {
  console.error(`check-sbf-build:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(
  `check-sbf-build: ${scripts.length} scripts, no SKS page or data, Navigationsaufgaben ${open ? 'built' : 'absent'}`,
)
