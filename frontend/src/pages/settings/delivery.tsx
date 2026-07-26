/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Copy, MailCheck, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { AllowlistResult, GatewayList, LocalizedText } from '../../types'

/** Allowlisting-Generator (Welle 9.1).
 *
 * Erzeugt aus den Gateway-Profilen des Backends fertige Schnipsel bzw.
 * Schrittfolgen. Die Profile sind Datendateien - neue Gateways erscheinen hier
 * ohne Frontend-Aenderung.
 */
export default function DeliverySettingsPage() {
  const { t, lang } = useI18n()
  const [list, setList] = useState<GatewayList | null>(null)
  const [gateway, setGateway] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<AllowlistResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Die Oberflaechensprache waehlt aus den zweisprachigen Texten des Profils.
  const pick = (text: LocalizedText | null | undefined): string =>
    !text ? '' : lang === 'en' ? text.en : text.de

  useEffect(() => {
    api
      .get<GatewayList>('/delivery/gateways')
      .then((res) => {
        setList(res.data)
        setValues(res.data.defaults)
        if (res.data.gateways.length > 0) setGateway(res.data.gateways[0].id)
      })
      .catch(() => setError(t('deliv.err.load')))
  }, [])

  const current = list?.gateways.find((g) => g.id === gateway)

  async function generate() {
    setError(null)
    try {
      const res = await api.post<AllowlistResult>('/delivery/allowlist', { gateway, inputs: values })
      setResult(res.data)
    } catch {
      setError(t('deliv.err.generate'))
    }
  }

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <PageScaffold
      title={t('settings.delivery')}
      subtitle={t('deliv.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.delivery'), icon: MailCheck },
      ]}
      guidanceKey="settings-delivery"
    >
      <div className="flex max-w-3xl flex-col gap-4">
        {error && <p className="text-sm text-status-danger">{error}</p>}

        <div className="rounded-lg border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('deliv.gateway')}</span>
            <select
              value={gateway}
              onChange={(e) => {
                setGateway(e.target.value)
                setResult(null)
              }}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
            >
              {list?.gateways.map((g) => (
                <option key={g.id} value={g.id}>
                  {pick(g.label)}
                </option>
              ))}
            </select>
          </label>

          {current?.inputs.map((key) => (
            <label key={key} className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium">{t(`deliv.input.${key}`)}</span>
              <input
                value={values[key] ?? ''}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                placeholder={t(`deliv.placeholder.${key}`)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <span className="text-sm text-text-secondary">{t(`deliv.hint.${key}`)}</span>
            </label>
          ))}

          <button
            onClick={generate}
            disabled={!gateway}
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {t('deliv.generate')}
          </button>
        </div>

        {result && (
          <>
            {result.missing_inputs.length > 0 && (
              <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
                {t('deliv.missing', {
                  fields: result.missing_inputs.map((k) => t(`deliv.input.${k}`)).join(', '),
                })}
              </p>
            )}

            {result.snippets.map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{pick(s.title)}</p>
                  {s.kind === 'code' && s.code && (
                    <button
                      onClick={() => copy(s.id, s.code as string)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm text-text-secondary hover:text-text-primary"
                    >
                      <Copy size={14} />
                      {copied === s.id ? t('deliv.copied') : t('deliv.copy')}
                    </button>
                  )}
                </div>

                {s.kind === 'code' && s.code && (
                  <pre className="mt-3 overflow-x-auto rounded-md bg-bg p-3 font-mono text-sm">
                    <code>{s.code}</code>
                  </pre>
                )}

                {s.kind === 'steps' && s.steps && (
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                    {(lang === 'en' ? s.steps.en : s.steps.de).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}

                {s.note && <p className="mt-3 text-sm text-text-secondary">{pick(s.note)}</p>}
              </div>
            ))}

            <p className="text-sm text-text-secondary">
              {t('deliv.disclaimer')}
              {result.vendor_docs && (
                <>
                  {' '}
                  <a
                    href={result.vendor_docs}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent underline"
                  >
                    {t('deliv.vendorDocs')}
                  </a>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </PageScaffold>
  )
}
