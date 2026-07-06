/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, PackageOpen } from 'lucide-react'
import AddonPage from '../../components/AddonPage'
import { useI18n } from '../../i18n'

export default function OpenCorePage() {
  const { t } = useI18n()
  return (
    <AddonPage
      tier="opencore"
      icon={PackageOpen}
      title={t('integrations.openCore')}
      tagline={t('addon.oc.tagline')}
      intro={t('addon.oc.intro')}
      breadcrumb={[
        { label: t('nav.integrations'), icon: Blocks },
        { label: t('integrations.openCore'), icon: PackageOpen },
      ]}
      groups={[
        {
          title: t('addon.oc.cat.auth'),
          items: [t('addon.oc.f.localLogin'), t('addon.oc.f.oidc'), t('addon.oc.f.twofa')],
        },
        {
          title: t('addon.oc.cat.campaigns'),
          items: [
            t('addon.oc.f.csvImport'),
            t('addon.oc.f.groups'),
            t('addon.oc.f.campaignCrud'),
            t('addon.oc.f.templates'),
            t('addon.oc.f.landingPages'),
          ],
        },
        {
          title: t('addon.oc.cat.delivery'),
          items: [
            t('addon.oc.f.smtp'),
            t('addon.oc.f.sendingProfiles'),
            t('addon.oc.f.fallbackSmtp'),
            t('addon.oc.f.tracking'),
          ],
        },
        {
          title: t('addon.oc.cat.reporting'),
          items: [
            t('addon.oc.f.dashboard'),
            t('addon.oc.f.kpi'),
            t('addon.oc.f.riskScore'),
            t('addon.oc.f.managementReports'),
            t('addon.oc.f.csvExport'),
          ],
        },
        {
          title: t('addon.oc.cat.operations'),
          items: [
            t('addon.oc.f.i18n'),
            t('addon.oc.f.darkMode'),
            t('addon.oc.f.auditLog'),
            t('addon.oc.f.dashboardSettings'),
          ],
        },
      ]}
    />
  )
}
