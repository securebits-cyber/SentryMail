/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Group } from '../types'

export interface GroupMemberInput {
  email: string
  first_name?: string
  last_name?: string
  position?: string
}

export interface GroupFormValues {
  name: string
  members: GroupMemberInput[]
}

interface GroupFormProps {
  initial?: Group | null
  onSubmit: (values: GroupFormValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

/**
 * Erwartet CSV mit Spalten: email,first_name,last_name,position (Header optional).
 * Trennzeichen wird pro Zeile erkannt: Semikolon (deutsche Excel-Exporte), Tab
 * oder Komma. Nur Zeilen mit einer erkennbaren E-Mail werden uebernommen.
 */
function parseCsv(csv: string): GroupMemberInput[] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Header-Zeile ueberspringen: keine "@"-Adresse, nennt aber "mail".
    .filter((line) => line.includes('@') || !/mail/i.test(line))
    .map((line) => {
      const delim = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ','
      const [email, first_name, last_name, position] = line.split(delim).map((v) => v?.trim())
      return {
        email,
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        position: position || undefined,
      }
    })
    .filter((m) => m.email && m.email.includes('@'))
}

export default function GroupForm({ initial, onSubmit, onCancel, submitting }: GroupFormProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [members, setMembers] = useState<GroupMemberInput[]>([])
  const [csv, setCsv] = useState('')
  const [csvMsg, setCsvMsg] = useState<string | null>(null)
  const emptyManual: GroupMemberInput = { email: '', first_name: '', last_name: '', position: '' }
  const [manual, setManual] = useState<GroupMemberInput>(emptyManual)

  useEffect(() => {
    setName(initial?.name ?? '')
    setMembers(
      (initial?.members ?? []).map((m) => ({
        email: m.email,
        first_name: m.first_name ?? undefined,
        last_name: m.last_name ?? undefined,
        position: m.position ?? undefined,
      })),
    )
    setCsv('')
  }, [initial])

  function addFromCsv() {
    const parsed = parseCsv(csv)
    if (parsed.length === 0) {
      setCsvMsg(t('grf.csvNoLine'))
      return
    }
    // Dedup per E-Mail (case-insensitive) gegen bereits vorhandene.
    const seen = new Set(members.map((m) => m.email.toLowerCase()))
    const merged = [...members]
    let added = 0
    for (const p of parsed) {
      if (!seen.has(p.email.toLowerCase())) {
        seen.add(p.email.toLowerCase())
        merged.push(p)
        added += 1
      }
    }
    setMembers(merged)
    setCsv('')
    const skipped = parsed.length - added
    setCsvMsg(skipped > 0 ? t('grf.addedSkipped', { added, skipped }) : t('grf.added', { n: added }))
  }

  function addManual() {
    const email = (manual.email || '').trim()
    if (!email || !email.includes('@')) {
      setCsvMsg(t('grf.invalidEmail'))
      return
    }
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      setCsvMsg(t('grf.duplicate'))
      return
    }
    setMembers((prev) => [
      ...prev,
      {
        email,
        first_name: manual.first_name?.trim() || undefined,
        last_name: manual.last_name?.trim() || undefined,
        position: manual.position?.trim() || undefined,
      },
    ])
    setManual(emptyManual)
    setCsvMsg(null)
  }

  function onManualKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addManual()
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then((text) => setCsv(text))
    event.target.value = '' // gleiche Datei erneut waehlbar machen
  }

  function removeMember(email: string) {
    setMembers((prev) => prev.filter((m) => m.email !== email))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ name, members })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm">{t('grf.manualAdd')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={manual.email}
            onChange={(e) => setManual({ ...manual, email: e.target.value })}
            onKeyDown={onManualKey}
            type="email"
            placeholder={t('common.email')}
            className={`${fieldClass} min-w-[220px] flex-1`}
          />
          <input
            value={manual.first_name ?? ''}
            onChange={(e) => setManual({ ...manual, first_name: e.target.value })}
            onKeyDown={onManualKey}
            placeholder={t('field.firstName')}
            className={`${fieldClass} w-32`}
          />
          <input
            value={manual.last_name ?? ''}
            onChange={(e) => setManual({ ...manual, last_name: e.target.value })}
            onKeyDown={onManualKey}
            placeholder={t('field.lastName')}
            className={`${fieldClass} w-32`}
          />
          <input
            value={manual.position ?? ''}
            onChange={(e) => setManual({ ...manual, position: e.target.value })}
            onKeyDown={onManualKey}
            placeholder={t('grf.position')}
            className={`${fieldClass} w-32`}
          />
          <button
            type="button"
            onClick={addManual}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {t('grf.add')}
          </button>
        </div>
      </div>

      <label className={labelClass}>
        {t('grf.csvLabel')}
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder="max.muster@example.com,Max,Muster,Buchhaltung"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addFromCsv}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t('grf.addCsv')}
        </button>
        <label className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg">
          {t('grf.csvFile')}
          <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} className="hidden" />
        </label>
        {csvMsg && <span className="text-sm text-text-secondary">{csvMsg}</span>}
      </div>

      <div>
        <div className="mb-2 text-sm text-text-secondary">
          {members.length} {t('common.recipients')}
        </div>
        {members.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-3 py-2 font-medium">{t('common.email')}</th>
                  <th className="px-3 py-2 font-medium">{t('field.firstName')}</th>
                  <th className="px-3 py-2 font-medium">{t('field.lastName')}</th>
                  <th className="px-3 py-2 font-medium">{t('grf.position')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.email} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 font-mono">{m.email}</td>
                    <td className="px-3 py-1.5">{m.first_name ?? ''}</td>
                    <td className="px-3 py-1.5">{m.last_name ?? ''}</td>
                    <td className="px-3 py-1.5">{m.position ?? ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeMember(m.email)}
                        aria-label={t('grf.removeMember')}
                        className="text-text-secondary hover:text-status-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? t('common.saving') : initial ? t('form.saveChanges') : t('grf.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
