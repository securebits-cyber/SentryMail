/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import IntegrationsLayout from './components/IntegrationsLayout'
import Layout from './components/Layout'
import SettingsLayout from './components/SettingsLayout'
import AiScoringPage from './pages/enterprise/ai-scoring'
import MultiTenantPage from './pages/enterprise/multi-tenant'
import WhiteLabelPage from './pages/enterprise/whitelabel'
import IntegrationsOverviewPage from './pages/integrations/overview'
import AuditEventsPage from './pages/settings/audit-events'
import LicenseSettingsPage from './pages/settings/license'
import SecuritySettingsPage from './pages/settings/security'
import CampaignsPage from './pages/campaigns'
import GroupsPage from './pages/groups'
import DashboardPage from './pages/index'
import LandingPagesPage from './pages/landing-pages'
import LoginPage from './pages/login'
import ProfilePage from './pages/profile'
import ResultsPage from './pages/results'
import SendingProfilesPage from './pages/sending-profiles'
import LdapSettingsPage from './pages/settings/ldap'
import OidcSettingsPage from './pages/settings/oidc'
import SmtpSettingsPage from './pages/settings/smtp'
import TemplatesPage from './pages/templates'
import UsersPage from './pages/users'
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
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/ldap" replace />} />
            <Route path="ldap" element={<LdapSettingsPage />} />
            <Route path="oidc" element={<OidcSettingsPage />} />
            <Route path="smtp" element={<SmtpSettingsPage />} />
            <Route path="security" element={<SecuritySettingsPage />} />
            <Route path="license" element={<LicenseSettingsPage />} />
            <Route path="audit-events" element={<AuditEventsPage />} />
          </Route>
          <Route path="/integrations" element={<IntegrationsLayout />}>
            <Route index element={<Navigate to="/integrations/overview" replace />} />
            <Route path="overview" element={<IntegrationsOverviewPage />} />
            <Route path="white-label" element={<WhiteLabelPage />} />
            <Route path="multi-tenant" element={<MultiTenantPage />} />
            <Route path="ai-scoring" element={<AiScoringPage />} />
          </Route>
          <Route path="/results/:campaignId" element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
