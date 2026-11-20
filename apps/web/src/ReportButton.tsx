import { useState } from 'react'
import { INCIDENT_TYPES, type IncidentType } from './api'
import { INCIDENT_INFO } from './incidents'

type Props = {
  onReport: (type: IncidentType) => Promise<void>
  hidden?: boolean
}

// Waze-style: big round button → grid of incident types. Reports at your GPS position.
export default function ReportButton({ onReport, hidden }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<IncidentType | null>(null)

  const pick = async (type: IncidentType) => {
    setBusy(type)
    try {
      await onReport(type)
      setOpen(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button
        className={`report-fab${hidden ? ' is-hidden' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Report an incident"
        aria-expanded={open}
      >
        {open ? '×' : '⚠️'}
      </button>

      {open && (
        <div className="report-sheet" role="dialog" aria-label="Report an incident">
          <p className="report-sheet__title">What's on the road?</p>
          <div className="report-sheet__grid">
            {INCIDENT_TYPES.map(t => (
              <button
                key={t}
                className="report-sheet__item"
                onClick={() => pick(t)}
                disabled={busy !== null}
              >
                <span className="report-sheet__emoji">{INCIDENT_INFO[t].emoji}</span>
                <span>{busy === t ? 'Sending…' : INCIDENT_INFO[t].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
