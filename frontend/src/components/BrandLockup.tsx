/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Marken-Lockup „sentrymail." mit Unterzeile SECURITY AWARENESS.
 *
 * Als Komponente statt als <img src="logo-lockup.svg">, aus zwei Gruenden:
 *
 * Erstens die Schrift. Ein SVG in einem <img> ist ein eigenes Dokument und
 * sieht die Webfonts der einbettenden Seite nicht — das Logo faellt dort auf
 * jedem Rechner ohne installiertes Roboto auf eine Ersatzschrift zurueck. Die
 * Doku-Seite loest das seit jeher genauso.
 *
 * Zweitens die Unterzeile. Das Design-System begrenzt sie auf minimal 8px
 * (`Math.max(8, size * 0.24)` in brand-wordmark.html). Ein SVG mit festem
 * Seitenverhaeltnis kann das nicht: Es skaliert alles gleichmaessig, und bei
 * der Kopfzeilen-Groesse von 24px waere die Unterzeile 3.5px hoch — ein grauer
 * Streifen, kein Text.
 *
 * Die Farben kommen aus den Tokens und folgen damit dem Farbschema, statt in
 * zwei Dateivarianten festzustehen. Der Ember-Punkt ist in Light und Dark
 * identisch.
 */

type Props = {
  /** Schriftgroesse der Wortmarke in px. Die Unterzeile leitet sich daraus ab. */
  size?: number
  /** Unterzeile ausblenden — fuer Stellen, an denen daneben schon ein Slogan steht. */
  tagline?: boolean
  className?: string
}

export default function BrandLockup({ size = 40, tagline = true, className = '' }: Props) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: `${size}px`,
          letterSpacing: '-0.04em',
        }}
        className="text-text-primary"
      >
        <span style={{ color: '#F0591F' }}>sentry</span>
        mail
        <span style={{ color: '#F0591F' }}>.</span>
      </span>
      {tagline && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-mono)',
            // Untergrenze wie im Design-System: darunter ist die Zeile nicht
            // mehr lesbar und stoert das Schriftbild, statt es zu ergaenzen.
            fontSize: `${Math.max(8, size * 0.24)}px`,
            letterSpacing: '0.32em',
            marginTop: `${Math.round(size * 0.18)}px`,
            // Die Laufweite haengt rechts einen Leerraum an; ohne Ausgleich
            // steht die Unterzeile sichtbar zu weit links unter der Wortmarke.
            marginRight: '-0.32em',
          }}
          className="self-end uppercase text-text-muted"
        >
          Security Awareness
        </span>
      )}
    </span>
  )
}
