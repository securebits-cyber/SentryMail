import { Blocks, Palette } from 'lucide-react'
import EnterprisePlaceholder from '../../components/EnterprisePlaceholder'

export default function WhiteLabelPage() {
  return (
    <EnterprisePlaceholder
      title="White-Label"
      icon={Palette}
      breadcrumb={[
        { label: 'Integrationen', icon: Blocks },
        { label: 'White-Label', icon: Palette },
      ]}
      tagline="Die Plattform im eigenen Marken-Auftritt."
      intro="Betreibe HumanShield.APP unter deiner eigenen Marke – Logo, Farben, Absenderdomains und Portal-URL individuell für deine Kunden."
      features={[
        'Eigenes Logo, Farbschema und Favicon',
        'Eigene Portal-Domain und E-Mail-Absender',
        'Angepasste Login- und Report-Vorlagen',
      ]}
    />
  )
}
