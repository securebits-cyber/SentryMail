/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { PackageCheck, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { BundleStatus, BundleVerifyResult } from '../../types'

/** Prueft ein signiertes Offline-Update-Bundle - bewusst ohne Einspielen.
 *
 * Das Einspielen tauscht Quelltext aus und startet den Stack neu; das gehoert
 * auf die Kommandozeile (`./update.sh --bundle`), nicht hinter einen Klick.
 * Diese Seite beantwortet nur die Frage davor: Ist das Bundle echt?
 */
export default function UpdatesSettingsPage() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<BundleStatus | null>(null)
  const [result, setResult] = useState<BundleVerifyResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<BundleStatus>('/updates/bundle/status')
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null))
  }, [])

  async function verify(file: File) {
    setChecking(true)
    setError(null)
    setResult(null)
    setFileName(file.name)
    const body = new FormData()
    body.append('file', file)
    try {
      const res = await api.post<BundleVerifyResult>('/updates/bundle/verify', body)
      setResult(res.data)
    } catch {
      setError(t('upd.err.upload'))
    } finally {
      setChecking(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const noKeys = status !== null && status.keys_configured === 0

  return (
    <PageScaffold
      title={t('settings.updates')}
      subtitle={t('upd.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.updates'), icon: PackageCheck },
      ]}
      guidanceKey="settings-updates"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        {noKeys && (
          <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm text-text-primary">
            {t('upd.noKeys')}
          </p>
        )}

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium">{t('upd.verify.label')}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('upd.verify.desc')}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".gz,.tgz,application/gzip"
            disabled={checking}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void verify(file)
            }}
            className="mt-3 block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent/12 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
          />
          {checking && <p className="mt-2 text-sm text-text-secondary">{t('upd.checking')}</p>}
          {error && <p className="mt-2 text-sm text-status-danger">{error}</p>}
        </div>

        {result && !result.valid && (
          <div className="rounded-lg border border-status-danger/40 bg-status-danger/10 p-4">
            <p className="text-sm font-medium text-status-danger">{t('upd.rejected')}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {result.code ? t(`upd.reason.${result.code}`) : t('upd.reason.unknown')}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{t('upd.rejected.hint')}</p>
          </div>
        )}

        {result?.valid && result.info && (
          <div className="rounded-lg border border-status-success/40 bg-status-success/10 p-4">
            <p className="text-sm font-medium">{t('upd.accepted')}</p>
            <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-text-secondary">{t('upd.field.target')}</dt>
              <dd className="font-mono">{result.info.target_version}</dd>
              <dt className="text-text-secondary">{t('upd.field.current')}</dt>
              <dd className="font-mono">{result.info.current_version}</dd>
              <dt className="text-text-secondary">{t('upd.field.min')}</dt>
              <dd className="font-mono">{result.info.min_version}</dd>
              <dt className="text-text-secondary">{t('upd.field.key')}</dt>
              <dd className="font-mono">{result.info.key_id}</dd>
              <dt className="text-text-secondary">{t('upd.field.files')}</dt>
              <dd className="font-mono">{result.info.file_count}</dd>
            </dl>
            {result.info.notes.map((note) => (
              <p key={note} className="mt-2 text-sm text-text-secondary">
                {note}
              </p>
            ))}
            <p className="mt-3 text-sm text-text-secondary">{t('upd.accepted.next')}</p>
            <code className="mt-1.5 block break-all rounded-md bg-bg px-3 py-2 font-mono text-sm">
              ./update.sh --bundle {fileName ?? 'bundle.tar.gz'}
            </code>
          </div>
        )}
      </div>
    </PageScaffold>
  )
}
