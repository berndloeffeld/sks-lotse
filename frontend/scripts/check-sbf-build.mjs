// After an SBF build (VITE_SITE=sbf, ADR-0067), checks dist/ holds SBF Lotse and nothing of SKS
// Lotse's app: no API client (the SBF build makes no API call) and none of SKS Lotse's data
// chunks. And the Navigationsaufgaben (ADR-0068) exactly as VITE_SBF says: with "on" their data chunk
// and originals, with "off" neither, nor their pages. Run by frontend-ci.yml after `npm run build`
// with the same env; exits non-zero on a finding.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assets = readdirSync(`${dist}assets`)
const scripts = assets.filter((name) => name.endsWith('.js'))
const problems = []

if (!readFileSync(`${dist}index.html`, 'utf8').includes('data-site="sbf"')) {
  problems.push('dist/index.html is not the SBF page (index.sbf.html)')
}
for (const name of scripts) {
  if (readFileSync(`${dist}assets/${name}`, 'utf8').includes('/api/v1')) {
    problems.push(`assets/${name} calls the API (/api/v1)`)
  }
}
for (const chunk of ['catalog.gen', 'chart_exercises.gen']) {
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
  `check-sbf-build: ${scripts.length} scripts, no API call, no SKS data, Navigationsaufgaben ${open ? 'built' : 'absent'}`,
)
