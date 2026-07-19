/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface LmsSettings {
  default_score_threshold: number
  default_due_days: number
  completion_coverage_percent: number
  quiz_pass_percent: number
  max_playback_rate: number
  retention_days: number
  signed_url_ttl_minutes: number
  max_upload_mb: number
  weekly_overdue_report: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

/** Zahlenfeld der LMS-Einstellungen (einheitliches Label + Grenzen). */
function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={fieldClass}
      />
    </label>
  )
}

export default function LmsSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [form, setForm] = useState<LmsSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<LmsSettings>('/lms/settings').then((res) => setForm(res.data))
  }, [licensed])

  function set<K extends keyof LmsSettings>(key: K, value: LmsSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      await api.patch('/lms/settings', form)
      setMessage({ kind: 'info', text: t('lms.settings.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('lms.settings.title')} subtitle={t('lms.settings.subtitle')} guidanceKey="lms-settings">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('dash.loading')}</p>

  return (
    <PageScaffold title={t('lms.settings.title')} subtitle={t('lms.settings.subtitle')} guidanceKey="lms-settings">
      <Card className="max-w-2xl">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label={t('lms.settings.scoreThreshold')}
              value={form.default_score_threshold}
              min={0}
              max={100}
              onChange={(v) => set('default_score_threshold', v)}
            />
            <NumberField
              label={t('lms.settings.dueDays')}
              value={form.default_due_days}
              min={1}
              max={365}
              onChange={(v) => set('default_due_days', v)}
            />
            <NumberField
              label={t('lms.settings.coverage')}
              value={form.completion_coverage_percent}
              min={50}
              max={100}
              onChange={(v) => set('completion_coverage_percent', v)}
            />
            <NumberField
              label={t('lms.settings.quizPass')}
              value={form.quiz_pass_percent}
              min={0}
              max={100}
              onChange={(v) => set('quiz_pass_percent', v)}
            />
            <NumberField
              label={t('lms.settings.maxRate')}
              value={form.max_playback_rate}
              min={1}
              max={4}
              step={0.25}
              onChange={(v) => set('max_playback_rate', v)}
            />
            <NumberField
              label={t('lms.settings.retention')}
              value={form.retention_days}
              min={1}
              max={3650}
              onChange={(v) => set('retention_days', v)}
            />
            <NumberField
              label={t('lms.settings.urlTtl')}
              value={form.signed_url_ttl_minutes}
              min={1}
              max={1440}
              onChange={(v) => set('signed_url_ttl_minutes', v)}
            />
            <NumberField
              label={t('lms.settings.maxUpload')}
              value={form.max_upload_mb}
              min={1}
              max={51200}
              onChange={(v) => set('max_upload_mb', v)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{t('lms.settings.weeklyReport')}</span>
            <Toggle
              checked={form.weekly_overdue_report}
              onChange={(v) => set('weekly_overdue_report', v)}
              aria-label={t('lms.settings.weeklyReport')}
            />
          </div>
          {message && (
            <p className={`text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-green-600'}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {t('cw.save')}
          </button>
        </form>
      </Card>
    </PageScaffold>
  )
}
