/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Badge, { BadgeTone } from '../components/Badge'
import CampaignWizard, { CampaignWizardValues } from '../components/CampaignWizard'
import Card from '../components/Card'
import PageScaffold from '../components/PageScaffold'
import { useI18n } from '../i18n'
import PreflightDialog from '../components/PreflightDialog'
import UsbDropPanel from '../components/UsbDropPanel'
import { api } from '../services/api'
import type { Campaign, GroupSummary, LandingPage, SendingProfile, Template } from '../types'

const statusKeys: Record<Campaign['status'], string> = {
  draft: 'camp.status.draft',
  scheduled: 'camp.status.scheduled',
  running: 'camp.status.running',
  completed: 'camp.status.completed',
  cancelled: 'camp.status.cancelled',
}

const statusTone: Record<Campaign['status'], BadgeTone> = {
  draft: 'neutral',
  scheduled: 'warning',
  running: 'accent',
  completed: 'success',
  cancelled: 'danger',
}

export default function CampaignsPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [profiles, setProfiles] = useState<SendingProfile[]>([])
  const [pages, setPages] = useState<LandingPage[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [preflightFor, setPreflightFor] = useState<Campaign | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function loadCampaigns() {
    return api.get<Campaign[]>('/campaigns').then((res) => setCampaigns(res.data))
  }

  useEffect(() => {
    Promise.all([
      loadCampaigns(),
      api.get<Template[]>('/templates').then((res) => setTemplates(res.data)),
      api.get<SendingProfile[]>('/sending-profiles').then((res) => setProfiles(res.data)),
      api.get<LandingPage[]>('/landing-pages').then((res) => setPages(res.data)),
      api.get<GroupSummary[]>('/groups').then((res) => setGroups(res.data)),
    ]).finally(() => setLoading(false))
  }, [])

  // Sidebar-Untermenue "Neue Kampagne erstellen" oeffnet die Seite mit ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreating(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Nach dem Anlegen einer USB-Kampagne geht es direkt weiter mit den
  // Fundorten - ohne Umweg ueber eine zweite Seite.
  const [usbCampaignId, setUsbCampaignId] = useState<string | null>(null)

  async function handleCreate(values: CampaignWizardValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      // Der Kanal gehoert zum Enterprise-Add-on und ist deshalb kein Feld des
      // Kampagnen-Endpunkts. Erst die Kampagne anlegen, dann den Kanal
      // dranhaengen - schlaegt das fehl, steht die Kampagne trotzdem und laesst
      // sich nachtraeglich zuordnen.
      const { channel, ...payload } = values
      const res = await api.post('/campaigns', payload)
      if (channel !== 'email') {
        await api.put(`/channels/campaigns/${res.data.id}`, { channel, message_text: '' })
      }
      setUsbCampaignId(channel === 'usb' ? String(res.data.id) : null)
      setCreating(false)
      await loadCampaigns()
      setMessage({
        kind: 'info',
        text: channel === 'usb' ? t('camp.createdUsb') : t('camp.created'),
      })
    } catch {
      setMessage({ kind: 'error', text: t('camp.err.create') })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(values: CampaignWizardValues) {
    if (!editing) return
    setSubmitting(true)
    setMessage(null)
    try {
      // Empfaengergruppen sind nach dem Anlegen fix (Schnappschuss); PATCH nimmt sie nicht.
      await api.patch(`/campaigns/${editing.id}`, {
        name: values.name,
        template_id: values.template_id,
        sending_profile_id: values.sending_profile_id,
        landing_page_id: values.landing_page_id,
        scheduled_at: values.scheduled_at,
      })
      setEditing(null)
      await loadCampaigns()
      setMessage({ kind: 'info', text: t('camp.updated') })
    } catch {
      setMessage({ kind: 'error', text: t('camp.err.update') })
    } finally {
      setSubmitting(false)
    }
  }

  // Der Start laeuft seit Welle 9.2 ueber den Pflichtdialog: Wer versendet,
  // soll vorher gesehen haben, wen er trifft und wann.
  async function handleSend(campaign: Campaign) {
    setMessage({ kind: 'info', text: t('camp.sendRunning') })
    try {
      const res = await api.post<{ success: number; failed: number }>(`/campaigns/${campaign.id}/send`)
      setMessage({ kind: 'info', text: t('camp.sendDone', { success: res.data.success, failed: res.data.failed }) })
      await loadCampaigns()
    } catch {
      setMessage({ kind: 'error', text: t('camp.err.send') })
    }
  }

  async function startAfterPreflight() {
    const campaign = preflightFor
    if (!campaign) return
    setPreflightFor(null)
    await handleSend(campaign)
  }

  async function handleDelete(campaign: Campaign) {
    if (!window.confirm(t('common.confirmDelete', { name: campaign.name }))) return
    setMessage(null)
    try {
      await api.delete(`/campaigns/${campaign.id}`)
      await loadCampaigns()
    } catch {
      setMessage({ kind: 'error', text: t('camp.err.delete') })
    }
  }

  if (creating) {
    return (
      <PageScaffold title={t('camp.newTitle')} guidanceKey="campaign-editor">
        {templates.length === 0 && <p className="mb-3 text-sm text-status-danger">{t('camp.needTemplate')}</p>}
        <CampaignWizard
          templates={templates}
          profiles={profiles}
          pages={pages}
          groups={groups}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          submitting={submitting}
        />
        {preflightFor && (
        <PreflightDialog
          campaign={preflightFor}
          onCancel={() => setPreflightFor(null)}
          onConfirmed={startAfterPreflight}
        />
      )}
    </PageScaffold>
    )
  }

  if (editing) {
    return (
      <PageScaffold title={t('camp.editTitle')} guidanceKey="campaign-editor">
        <CampaignWizard
          mode="edit"
          initialValues={{
            name: editing.name,
            template_id: editing.template_id,
            sending_profile_id: editing.sending_profile_id,
            landing_page_id: editing.landing_page_id,
            group_ids: [],
            scheduled_at: editing.scheduled_at,
            channel: 'email',
          }}
          templates={templates}
          profiles={profiles}
          pages={pages}
          groups={groups}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
          submitting={submitting}
        />
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title={t('nav.campaigns')}
      guidanceKey="campaigns"
      actions={
        <button
          onClick={() => setCreating(true)}
          disabled={templates.length === 0}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {t('camp.new')}
        </button>
      }
    >
      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {/* Direkt nach dem Anlegen einer USB-Kampagne: Fundorte anlegen und das
          Paket holen, ohne die Seite zu wechseln. */}
      {usbCampaignId && (
        <div className="mb-6 flex flex-col gap-2">
          <UsbDropPanel campaignId={usbCampaignId} />
          <button
            type="button"
            onClick={() => setUsbCampaignId(null)}
            className="self-start text-sm text-text-secondary underline"
          >
            {t('camp.usbDone')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-text-secondary">{t('camp.loading')}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-text-secondary">{t('camp.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.status')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-border">
                  <td className="py-2 pr-4">{campaign.name}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={statusTone[campaign.status]}>{t(statusKeys[campaign.status])}</Badge>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => setPreflightFor(campaign)} className="mr-3 text-status-success hover:underline">
                      {t('camp.send')}
                    </button>
                    {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                      <button
                        onClick={() => setEditing(campaign)}
                        className="mr-3 text-text-secondary hover:text-accent hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                    )}
                    <Link to={`/results/${campaign.id}`} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      {t('camp.results')}
                    </Link>
                    <button onClick={() => handleDelete(campaign)} className="text-status-danger hover:underline">
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageScaffold>
  )
}
