/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, Briefcase } from 'lucide-react'
import AddonPage from '../../components/AddonPage'
import { useI18n } from '../../i18n'

export default function BusinessAddonPage() {
  const { t } = useI18n()
  return (
    <AddonPage
      tier="business"
      icon={Briefcase}
      title={t('integrations.business')}
      tagline={t('addon.biz.tagline')}
      intro={t('addon.biz.intro')}
      breadcrumb={[
        { label: t('nav.integrations'), icon: Blocks },
        { label: t('integrations.business'), icon: Briefcase },
      ]}
      groups={[
        {
          title: t('addon.biz.cat.campaigns'),
          items: [
            t('addon.biz.f.recurring'),
            t('addon.biz.f.multistage'),
            t('addon.biz.f.byGroup'),
            t('addon.biz.f.spear'),
            t('addon.biz.f.whaling'),
            t('addon.biz.f.quishing'),
            t('addon.biz.f.fileBased'),
            t('addon.biz.f.credCapture'),
          ],
        },
        {
          title: t('addon.biz.cat.templates'),
          items: [
            t('addon.biz.f.brandTemplates'),
            t('addon.biz.f.vendorLogins'),
            t('addon.biz.f.banks'),
            t('addon.biz.f.social'),
            t('addon.biz.f.hr'),
            t('addon.biz.f.pdfLure'),
            t('addon.biz.f.qrTemplates'),
          ],
        },
        {
          title: t('addon.biz.cat.directory'),
          items: [
            t('addon.biz.f.webhooks'),
            t('addon.biz.f.ldap'),
            t('addon.biz.f.azureEntra'),
            t('addon.biz.f.groupMgmt'),
            t('addon.biz.f.mailReport'),
          ],
        },
        {
          title: t('addon.biz.cat.reporting'),
          items: [
            t('addon.biz.f.pdfExport'),
            t('addon.biz.f.executive'),
            t('addon.biz.f.management'),
            t('addon.biz.f.complianceReports'),
            t('addon.biz.f.userDev'),
            t('addon.biz.f.deptCompare'),
            t('addon.biz.f.trends'),
            t('addon.biz.f.learning'),
          ],
        },
        {
          title: t('addon.biz.cat.compliance'),
          items: [
            t('addon.biz.f.gdpr'),
            t('addon.biz.f.nis2'),
            t('addon.biz.f.iso27001'),
            t('addon.biz.f.awarenessProof'),
            t('addon.biz.f.auditReports'),
            t('addon.biz.f.certificates'),
            t('addon.biz.f.trainingProofs'),
          ],
        },
      ]}
    />
  )
}
