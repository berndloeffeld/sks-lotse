import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { LandingPage } from './pages/LandingPage'
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
        <Route element={<ProtectedRoute />}>
          <Route path="/start" element={<StartPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
