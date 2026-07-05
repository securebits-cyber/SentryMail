/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, Brain } from 'lucide-react'
import EnterprisePlaceholder from '../../components/EnterprisePlaceholder'

export default function AiScoringPage() {
  return (
    <EnterprisePlaceholder
      title="AI-Scoring"
      icon={Brain}
      breadcrumb={[
        { label: 'Integrationen', icon: Blocks },
        { label: 'AI-Scoring', icon: Brain },
      ]}
      tagline="Risiko-Bewertung mit KI-Unterstützung."
      intro="Bewerte das Phishing-Risiko pro Empfänger und Kampagne automatisch und erkenne gefährdete Gruppen früher."
      features={[
        'Risiko-Score je Empfänger und Abteilung',
        'Automatische Erkennung auffälliger Muster',
        'Empfehlungen für gezielte Trainings',
      ]}
    />
  )
}
