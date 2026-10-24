import { Link } from 'react-router-dom'

import { buttonClass } from '../shared/components/buttonStyles'
import { SbfPageLayout } from './SbfPageLayout'

export function SbfNotFoundPage() {
  return (
    <SbfPageLayout title="Seite nicht gefunden" compact>
      <p className="text-ink">
        Unter dieser Adresse gibt es keine Seite. Vielleicht ist der Link veraltet oder vertippt.
      </p>
      <Link to="/" className={`${buttonClass('primary')} self-start`}>
        Zur Startseite
      </Link>
    </SbfPageLayout>
  )
}
