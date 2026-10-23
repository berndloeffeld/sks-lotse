// After an SBF build (VITE_SITE=sbf, ADR-0067), checks dist/ holds SBF Lotse and nothing of SKS
// Lotse's app: no API client (the SBF build makes no API call) and none of SKS Lotse's data
// chunks. Run by frontend-ci.yml after `npm run build`; exits non-zero on a finding.
import { readdirSync, readFileSync } from 'node:fs'
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

if (problems.length > 0) {
  console.error(`check-sbf-build:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-sbf-build: ${scripts.length} scripts, no API call, no SKS data`)
