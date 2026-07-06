/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, Building2 } from 'lucide-react'
import AddonPage from '../../components/AddonPage'
import { useI18n } from '../../i18n'

export default function EnterpriseAddonPage() {
  const { t } = useI18n()
  return (
    <AddonPage
      tier="enterprise"
      icon={Building2}
      title={t('integrations.enterprise')}
      tagline={t('addon.ent.tagline')}
      intro={t('addon.ent.intro')}
      breadcrumb={[
        { label: t('nav.integrations'), icon: Blocks },
        { label: t('integrations.enterprise'), icon: Building2 },
      ]}
      groups={[
        {
          title: t('addon.ent.cat.platform'),
          items: [t('addon.ent.f.whiteLabel'), t('addon.ent.f.multiTenant'), t('addon.ent.f.saml')],
        },
        {
          title: t('addon.ent.cat.intelligence'),
          items: [t('addon.ent.f.aiScoring'), t('addon.ent.f.riskBased'), t('addon.ent.f.automatic')],
        },
        {
          title: t('addon.ent.cat.reporting'),
          items: [t('addon.ent.f.trainingProgress'), t('addon.ent.f.certStatus'), t('addon.ent.f.customReports')],
        },
      ]}
    />
  )
}
