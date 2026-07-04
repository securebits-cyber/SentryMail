import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CampaignsPage from './pages/campaigns'
import DashboardPage from './pages/index'
import LoginPage from './pages/login'
import ResultsPage from './pages/results'
import { consumeTokenFromUrlFragment, isAuthenticated } from './services/auth'

function RequireAuth({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    consumeTokenFromUrlFragment()
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/results/:campaignId" element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
