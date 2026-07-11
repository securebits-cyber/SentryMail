/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { X } from 'lucide-react'
import { ChangeEvent } from 'react'
import { useI18n } from '../i18n'

// Client-seitiges Limit (der Server validiert/normalisiert zusätzlich).
const MAX_LOGO_BYTES = 512 * 1024

/** Einheitliches Logo-Upload-Feld (Vorschau/Entfernen). Erlaubt nur PNG/JPG/SVG;
 *  die eigentliche Sicherheit liegt serverseitig. Auf hellem Grund für das
 *  Light-Logo, auf dunklem Grund als Vorschau für das Dark-Logo. */
export default function LogoUploadField({
  label,
  value,
  onChange,
  uploadLabel,
  onTooLarge,
  darkPreview = false,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  uploadLabel: string
  onTooLarge?: () => void
  darkPreview?: boolean
}) {
  const { t } = useI18n()

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      onTooLarge?.()
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      {label}
      <div className="flex items-center gap-3">
        {value ? (
          <>
            <img
              src={value}
              alt=""
              className={`h-10 max-w-[180px] rounded border border-border object-contain p-1 ${darkPreview ? 'bg-neutral-900' : 'bg-white'}`}
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-text-secondary hover:text-status-danger"
              aria-label={t('common.delete')}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg">
            {uploadLabel}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onFile} className="hidden" />
          </label>
        )}
      </div>
    </div>
  )
}
