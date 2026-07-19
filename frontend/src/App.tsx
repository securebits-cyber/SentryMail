/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { type ReactElement } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import IntegrationsLayout from './components/IntegrationsLayout'
import Layout from './components/Layout'
import SettingsLayout from './components/SettingsLayout'
import BusinessAddonPage from './pages/integrations/business'
import EnterpriseAddonPage from './pages/integrations/enterprise'
import OpenCorePage from './pages/integrations/opencore'
import IntegrationsOverviewPage from './pages/integrations/overview'
import AiSettingsPage from './pages/settings/ai'
import AuditEventsPage from './pages/settings/audit-events'
import EntraSettingsPage from './pages/settings/entra'
import LicenseSettingsPage from './pages/settings/license'
import SecuritySettingsPage from './pages/settings/security'
import CampaignsPage from './pages/campaigns'
import GroupsPage from './pages/groups'
import DashboardPage from './pages/index'
import LandingPagesPage from './pages/landing-pages'
import LoginPage from './pages/login'
import AutoCampaignsPage from './pages/auto-campaigns'
import MultiStagePage from './pages/multistage'
import ProfilePage from './pages/profile'
import RecurringPage from './pages/recurring'
import ReportsPage from './pages/reports'
import ResultsPage from './pages/results'
import SendingProfilesPage from './pages/sending-profiles'
import LdapSettingsPage from './pages/settings/ldap'
import OidcSettingsPage from './pages/settings/oidc'
import SamlSettingsPage from './pages/settings/saml'
import SiemSettingsPage from './pages/settings/siem'
import SmtpSettingsPage from './pages/settings/smtp'
import WebhooksSettingsPage from './pages/settings/webhooks'
import PdfReportSettingsPage from './pages/settings/pdf-report'
import WhitelabelSettingsPage from './pages/settings/whitelabel'
import TemplatesPage from './pages/templates'
import TrainingsPage from './pages/trainings'
import TrainingPlayerPage from './pages/trainings-player'
import LmsAssignmentsPage from './pages/lms/assignments'
import LmsCoursesPage from './pages/lms/courses'
import LmsReportsPage from './pages/lms/reports'
import LmsSettingsPage from './pages/settings/lms'
import UsersPage from './pages/users'
import { isAuthenticated } from './services/auth'

function RequireAuth({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
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
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/multistage" element={<MultiStagePage />} />
          <Route path="/auto-campaigns" element={<AutoCampaignsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/trainings" element={<TrainingsPage />} />
          <Route path="/trainings/:assignmentId" element={<TrainingPlayerPage />} />
          <Route path="/lms/courses" element={<LmsCoursesPage />} />
          <Route path="/lms/assignments" element={<LmsAssignmentsPage />} />
          <Route path="/lms/reports" element={<LmsReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/ldap" replace />} />
            <Route path="ldap" element={<LdapSettingsPage />} />
            <Route path="webhooks" element={<WebhooksSettingsPage />} />
            <Route path="entra" element={<EntraSettingsPage />} />
            <Route path="ai" element={<AiSettingsPage />} />
            <Route path="pdf-report" element={<PdfReportSettingsPage />} />
            <Route path="whitelabel" element={<WhitelabelSettingsPage />} />
            <Route path="siem" element={<SiemSettingsPage />} />
            <Route path="saml" element={<SamlSettingsPage />} />
            <Route path="lms" element={<LmsSettingsPage />} />
            <Route path="oidc" element={<OidcSettingsPage />} />
            <Route path="smtp" element={<SmtpSettingsPage />} />
            <Route path="security" element={<SecuritySettingsPage />} />
            <Route path="license" element={<LicenseSettingsPage />} />
            <Route path="audit-events" element={<AuditEventsPage />} />
          </Route>
          <Route path="/integrations" element={<IntegrationsLayout />}>
            <Route index element={<Navigate to="/integrations/overview" replace />} />
            <Route path="overview" element={<IntegrationsOverviewPage />} />
            <Route path="opencore" element={<OpenCorePage />} />
            <Route path="business" element={<BusinessAddonPage />} />
            <Route path="enterprise" element={<EnterpriseAddonPage />} />
          </Route>
          <Route path="/results/:campaignId" element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
