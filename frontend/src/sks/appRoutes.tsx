import type { RouteObject } from 'react-router-dom'

import { AppRoutes } from './App'

// The whole app as one data-router route (ADR-0059): the routes stay AppRoutes' <Routes>, the data
// router is there for useBlocker. main.tsx serves it from a browser router, the prerender
// (entry-server.tsx) from a memory router, so both render the same tree and hydration matches.
export const appRoutes: RouteObject[] = [{ path: '*', element: <AppRoutes /> }]
