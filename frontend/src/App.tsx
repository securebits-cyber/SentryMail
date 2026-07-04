import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CampaignsPage from './pages/campaigns'
import GroupsPage from './pages/groups'
import DashboardPage from './pages/index'
import LandingPagesPage from './pages/landing-pages'
import LoginPage from './pages/login'
import ResultsPage from './pages/results'
import SendingProfilesPage from './pages/sending-profiles'
import SettingsPage from './pages/settings'
import TemplatesPage from './pages/templates'
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
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/sending-profiles" element={<SendingProfilesPage />} />
          <Route path="/landing-pages" element={<LandingPagesPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/results/:campaignId" element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
