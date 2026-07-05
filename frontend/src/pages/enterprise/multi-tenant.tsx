import { Blocks, Building2 } from 'lucide-react'
import EnterprisePlaceholder from '../../components/EnterprisePlaceholder'

export default function MultiTenantPage() {
  return (
    <EnterprisePlaceholder
      title="Multi-Tenant"
      icon={Building2}
      breadcrumb={[
        { label: 'Integrationen', icon: Blocks },
        { label: 'Multi-Tenant', icon: Building2 },
      ]}
      tagline="Mehrere Mandanten strikt getrennt verwalten."
      intro="Verwalte mehrere Organisationen oder Kunden getrennt in einer Installation – mit eigenen Nutzern, Kampagnen und Auswertungen je Mandant."
      features={[
        'Strikte Datentrennung pro Mandant',
        'Mandanten-Administratoren mit eigenem Scope',
        'Zentrale Verwaltung und Abrechnung',
      ]}
    />
  )
}
