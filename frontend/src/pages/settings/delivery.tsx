/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Copy, MailCheck, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type {
  AllowlistResult,
  Campaign,
  DeliveryConfig,
  DeliverySelfTest,
  GatewayList,
  LocalizedText,
} from '../../types'

/** Zustellungs-Assistent (Welle 9.1).
 *
 * Zwei Teile: das Kanarienpostfach fuer den Zustell-Selbsttest und der
 * Allowlisting-Generator. Dessen Gateway-Profile sind Datendateien im
 * Backend - neue Gateways erscheinen hier ohne Frontend-Aenderung.
 *
 * Die Diagnose des dritten Teils sitzt bewusst nicht hier, sondern auf der
 * Ergebnisseite der Kampagne, wo die Frage aufkommt.
 */
export default function DeliverySettingsPage() {
  const { t, lang } = useI18n()
  const [list, setList] = useState<GatewayList | null>(null)
  const [gateway, setGateway] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<AllowlistResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Kanarienpostfach (Selbsttest)
  const [config, setConfig] = useState<DeliveryConfig | null>(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [testCampaign, setTestCampaign] = useState('')
  const [test, setTest] = useState<DeliverySelfTest | null>(null)
  const [testing, setTesting] = useState(false)

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

    api.get<DeliveryConfig>('/delivery/config').then((res) => setConfig(res.data)).catch(() => undefined)
    api
      .get<Campaign[]>('/campaigns')
      .then((res) => {
        setCampaigns(res.data)
        if (res.data.length > 0) setTestCampaign(res.data[0].id)
      })
      .catch(() => undefined)
  }, [])

  async function saveConfig() {
    if (!config) return
    setSaving(true)
    setSaved(false)
    // Alte Meldung raeumen, sonst bleibt sie trotz Erfolg stehen.
    setError(null)
    try {
      // Leeres Feld = Passwort unveraendert lassen. Nur ein bewusstes Leeren
      // ueber den Knopf loescht es - sonst verliert jedes Speichern das Passwort.
      const res = await api.put<DeliveryConfig>('/delivery/config', {
        ...config,
        imap_password: password === '' ? null : password,
      })
      setConfig(res.data)
      setPassword('')
      setSaved(true)
    } catch {
      setError(t('deliv.err.save'))
    } finally {
      setSaving(false)
    }
  }

  async function runSelfTest() {
    setTesting(true)
    setError(null)
    try {
      const res = await api.post<DeliverySelfTest>(`/delivery/selftest/${testCampaign}`)
      setTest(res.data)
    } catch {
      setError(t('deliv.err.selftest'))
    } finally {
      setTesting(false)
    }
  }

  async function refreshSelfTest() {
    setError(null)
    const res = await api.get<DeliverySelfTest | null>(`/delivery/selftest/${testCampaign}`)
    setTest(res.data)
  }

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

        {/* Kanarienpostfach: Probemail vor dem Kampagnenstart. */}
        {config && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">{t('deliv.canary.title')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('deliv.canary.desc')}</p>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('deliv.canary.address')}</span>
              <input
                value={config.canary_address}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, canary_address: e.target.value } : prev))}
                placeholder="kanarienvogel@example.de"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <span className="text-sm text-text-secondary">{t('deliv.canary.addressHint')}</span>
            </label>

            <p className="mt-4 text-sm font-medium">{t('deliv.canary.imap')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('deliv.canary.imapHint')}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input
                value={config.imap_host}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, imap_host: e.target.value } : prev))}
                placeholder="imap.example.de"
                className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <input
                type="number"
                value={config.imap_port}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, imap_port: Number(e.target.value) } : prev))}
                className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <input
                value={config.imap_username}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, imap_username: e.target.value } : prev))}
                placeholder={t('deliv.canary.user')}
                className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config.has_imap_password ? t('deliv.canary.pwSet') : t('deliv.canary.pw')}
                className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <input
                value={config.imap_mailbox}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, imap_mailbox: e.target.value } : prev))}
                className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.imap_use_ssl}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, imap_use_ssl: e.target.checked } : prev))}
                  className="accent-accent"
                />
                {t('deliv.canary.ssl')}
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {t('common.save')}
              </button>
              {saved && <span className="text-sm text-text-secondary">{t('deliv.saved')}</span>}
            </div>

            {config.canary_address && campaigns.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm font-medium">{t('deliv.test.title')}</p>
                <p className="mt-1 text-sm text-text-secondary">{t('deliv.test.desc')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={testCampaign}
                    onChange={(e) => {
                      setTestCampaign(e.target.value)
                      setTest(null)
                    }}
                    className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={runSelfTest}
                    disabled={testing || !testCampaign}
                    className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                  >
                    {t('deliv.test.run')}
                  </button>
                  {test?.status === 'pending' && (
                    <button
                      onClick={refreshSelfTest}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      {t('deliv.test.refresh')}
                    </button>
                  )}
                </div>

                {test && (
                  <p
                    className={`mt-3 text-sm ${
                      test.status === 'passed'
                        ? 'text-status-success'
                        : test.status === 'failed'
                          ? 'text-status-danger'
                          : 'text-text-secondary'
                    }`}
                  >
                    {t(`deliv.test.${test.status}`)}
                    {test.error && <span className="block text-text-secondary">{test.error}</span>}
                    <span className="block text-text-secondary">
                      {t('deliv.test.route', { route: test.route })}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
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
