import { FormEvent, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
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

/** Erwartet CSV mit Spalten: email,first_name,last_name,position (Header optional). */
function parseCsv(csv: string): GroupMemberInput[] {
  return csv
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith('email'))
    .map((line) => {
      const [email, first_name, last_name, position] = line.split(',').map((v) => v?.trim())
      return {
        email,
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        position: position || undefined,
      }
    })
    .filter((m) => m.email)
}

export default function GroupForm({ initial, onSubmit, onCancel, submitting }: GroupFormProps) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState<GroupMemberInput[]>([])
  const [csv, setCsv] = useState('')

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
    if (parsed.length === 0) return
    // Dedup per E-Mail (case-insensitive) gegen bereits vorhandene.
    const seen = new Set(members.map((m) => m.email.toLowerCase()))
    const merged = [...members]
    for (const p of parsed) {
      if (!seen.has(p.email.toLowerCase())) {
        seen.add(p.email.toLowerCase())
        merged.push(p)
      }
    }
    setMembers(merged)
    setCsv('')
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
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        Empfänger per CSV (email,first_name,last_name,position)
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder="max.muster@example.com,Max,Muster,Buchhaltung"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>
      <div>
        <button
          type="button"
          onClick={addFromCsv}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
        >
          Aus CSV hinzufügen
        </button>
      </div>

      <div>
        <div className="mb-2 text-sm text-text-secondary">{members.length} Empfänger</div>
        {members.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-3 py-2 font-medium">E-Mail</th>
                  <th className="px-3 py-2 font-medium">Vorname</th>
                  <th className="px-3 py-2 font-medium">Nachname</th>
                  <th className="px-3 py-2 font-medium">Position</th>
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
                        aria-label="Empfänger entfernen"
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
          {submitting ? 'Speichern...' : initial ? 'Änderungen speichern' : 'Gruppe anlegen'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
