import type { RouteObject } from 'react-router-dom'

import { SbfApp } from './SbfApp'

// The SBF site as one data-router route, like ../appRoutes.tsx: main.tsx serves it from a browser
// router, the prerender (entry-server.tsx) from a memory router, so both render the same tree.
export const sbfRoutes: RouteObject[] = [{ path: '*', element: <SbfApp /> }]
