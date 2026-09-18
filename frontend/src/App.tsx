import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { DatenschutzPage } from './pages/DatenschutzPage'
import { ImpressumPage } from './pages/ImpressumPage'
import { LandingPage } from './pages/LandingPage'
import { LernenPage } from './pages/LernenPage'
import { LoginPage } from './pages/LoginPage'
import { StartPage } from './pages/StartPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { useAuthStore } from './store/authStore'

function App() {
  const checkSession = useAuthStore((state) => state.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/datenschutz" element={<DatenschutzPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/start" element={<StartPage />} />
          <Route path="/lernen" element={<LernenPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
