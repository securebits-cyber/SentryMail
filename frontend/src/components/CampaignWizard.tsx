/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FormEvent, useState } from 'react'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import type { ChannelKind, GroupSummary, LandingPage, SendingProfile, Template } from '../types'
import TierBadge from './TierBadge'

/** Kanal einer Kampagne. ``email`` ist der Core-Weg und braucht keine Lizenz;
 *  alles Weitere gehört zum Enterprise-Add-on. */
export type WizardChannel = 'email' | ChannelKind

export interface CampaignWizardValues {
  name: string
  template_id: string | null
  sending_profile_id: string | null
  landing_page_id: string | null
  group_ids: string[]
  scheduled_at: string | null
  /** Nicht Teil des Kampagnen-Endpunkts — die Seite legt damit hinterher den
   *  Kanal über das Add-on an. ``email`` heißt: nichts anzulegen. */
  channel: WizardChannel
}

/** Was ein Kanal braucht. Der USB-Drop ist der Sonderfall, für den es diese
 *  Tabelle überhaupt gibt: Er legt Datenträger aus, statt etwas zu versenden.
 *
 *  Die Landing Page bleibt bei USB **aktiv** — die HTML-Datei auf dem Stick
 *  verweist auf sie, und ohne sie liefe der Fund ins Leere. Genau hier wäre
 *  „alles ausgrauen, was nicht nach Mail aussieht" ein Fehler. */
const NEEDS: Record<WizardChannel, { template: boolean; profile: boolean; groups: boolean; schedule: boolean }> = {
  email: { template: true, profile: true, groups: true, schedule: true },
  sms: { template: false, profile: false, groups: true, schedule: true },
  matrix: { template: false, profile: false, groups: true, schedule: true },
  talk: { template: false, profile: false, groups: true, schedule: true },
  usb: { template: false, profile: false, groups: false, schedule: false },
}

const CHANNELS: WizardChannel[] = ['email', 'sms', 'matrix', 'talk', 'usb']

interface CampaignWizardProps {
  templates: Template[]
  profiles: SendingProfile[]
  pages: LandingPage[]
  groups: GroupSummary[]
  onSubmit: (values: CampaignWizardValues) => void
  onCancel: () => void
  submitting?: boolean
  // Vorbelegung zum Bearbeiten einer bestehenden Kampagne. Im Edit-Modus sind die
  // Empfaengergruppen nicht mehr aenderbar (Empfaenger werden beim Anlegen als
  // Schnappschuss uebernommen); der PATCH-Endpunkt akzeptiert group_ids nicht.
  initialValues?: CampaignWizardValues
  mode?: 'create' | 'edit'
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

// ISO-Zeitstempel in die separaten date-/time-Inputs zerlegen (lokale Zeit).
function splitSchedule(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export default function CampaignWizard({
  templates,
  profiles,
  pages,
  groups,
  onSubmit,
  onCancel,
  submitting,
  initialValues,
  mode = 'create',
}: CampaignWizardProps) {
  const { t } = useI18n()
  const features = useFeatures()
  const enterprise = Boolean(features?.features?.enterprise)
  const isEdit = mode === 'edit'
  const initialSchedule = splitSchedule(initialValues?.scheduled_at ?? null)
  const [name, setName] = useState(initialValues?.name ?? '')
  const [channel, setChannel] = useState<WizardChannel>(initialValues?.channel ?? 'email')
  const needs = NEEDS[channel]
  const [templateId, setTemplateId] = useState(initialValues?.template_id ?? templates[0]?.id ?? '')
  const [profileId, setProfileId] = useState(initialValues?.sending_profile_id ?? '')
  const [pageId, setPageId] = useState(initialValues?.landing_page_id ?? '')
  const [groupIds, setGroupIds] = useState<string[]>(initialValues?.group_ids ?? [])
  const [scheduleDate, setScheduleDate] = useState(initialSchedule.date)
  const [scheduleTime, setScheduleTime] = useState(initialSchedule.time)

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Datum + Uhrzeit zu einem ISO-Zeitstempel kombinieren (Uhrzeit optional -> 00:00).
    const scheduledAt = scheduleDate
      ? new Date(`${scheduleDate}T${scheduleTime || '00:00'}`).toISOString()
      : null
    // Was der Kanal nicht braucht, wird nicht mitgeschickt statt nur
    // ausgegraut: Ein ausgegrautes Feld behält sonst den Wert, den es vor dem
    // Umschalten hatte, und die Kampagne trüge eine Vorlage, die niemand
    // ausgewählt hat.
    onSubmit({
      name,
      template_id: needs.template ? templateId : null,
      sending_profile_id: needs.profile ? profileId || null : null,
      landing_page_id: pageId || null,
      group_ids: needs.groups ? groupIds : [],
      scheduled_at: needs.schedule ? scheduledAt : null,
      channel,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      {/* Nur beim Anlegen. Der Kanal liegt im Enterprise-Add-on, der Core kennt
          ihn nicht — ein Auswahlfeld beim Bearbeiten müsste raten und zeigte
          bei einer USB-Kampagne „E-Mail" an. Lieber gar nichts als das. */}
      {!isEdit && (
        <label className={labelClass}>
          <span className="inline-flex items-center gap-2">
            {t('cw.channel')}
            <TierBadge tier="enterprise" locked={enterprise ? false : undefined} />
          </span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as WizardChannel)}
            className={fieldClass}
          >
            {CHANNELS.map((item) => (
              // Ohne Enterprise-Lizenz sichtbar, aber nicht wählbar: Die
              // Funktion zu verschweigen wäre unehrlich, sie anzubieten und
              // dann beim Speichern abzulehnen ärgerlich.
              <option key={item} value={item} disabled={item !== 'email' && !enterprise}>
                {t(`cw.channel.${item}`)}
              </option>
            ))}
          </select>
          <span className="text-sm text-text-secondary">{t(`cw.channelHint.${channel}`)}</span>
        </label>
      )}

      <label className={labelClass}>
        {t('cw.template')}
        <select
          value={needs.template ? templateId : ''}
          onChange={(e) => setTemplateId(e.target.value)}
          required={needs.template}
          disabled={!needs.template}
          className={`${fieldClass} disabled:opacity-50`}
        >
          {!needs.template && <option value="">{t('cw.notNeeded')}</option>}
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('cw.sendingProfile')}
        <select
          value={needs.profile ? profileId : ''}
          onChange={(e) => setProfileId(e.target.value)}
          disabled={!needs.profile}
          className={`${fieldClass} disabled:opacity-50`}
        >
          <option value="">{needs.profile ? t('cw.globalSmtp') : t('cw.notNeeded')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('cw.landingPage')}
        <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={fieldClass}>
          <option value="">{t('cw.none')}</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {!needs.groups ? (
        // Beim USB-Drop sind die Fundorte die Empfänger — sie entstehen nach
        // dem Anlegen als Datenträger, nicht hier aus einer Gruppe.
        <p className="text-sm text-text-secondary">{t('cw.groupsNotNeeded')}</p>
      ) : isEdit ? (
        <p className="text-sm text-text-secondary">{t('cw.groupsLocked')}</p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <span>{t('nav.groups')}</span>
          {groups.length === 0 ? (
            <span className="text-text-secondary">{t('cw.noGroups')}</span>
          ) : (
            <div className="flex flex-col gap-1 rounded-md border border-border p-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  {g.name}
                  <span className="font-mono text-xs text-text-secondary">({g.member_count})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <span>{t('cw.schedule')}</span>
        {needs.schedule ? (
          <div className="flex gap-3">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className={`${fieldClass} flex-1`}
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              disabled={!scheduleDate}
              className={`${fieldClass} w-36 disabled:opacity-50`}
            />
          </div>
        ) : (
          <span className="text-text-secondary">{t('cw.scheduleNotNeeded')}</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          // Ohne Gruppen kein Versand - ausser der Kanal braucht keine.
          disabled={submitting || (!isEdit && needs.groups && groupIds.length === 0)}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {isEdit
            ? submitting
              ? t('cw.saving')
              : t('cw.save')
            : submitting
              ? t('cw.creating')
              : t('cw.create')}
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
