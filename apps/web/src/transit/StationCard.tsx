import { linesAt } from './lookup'
import { departureStatus, formatClock } from './schedule'
import type { Line, TransitData } from './types'
import './transit.css'

const MODE: Record<string, string> = {
  AG: 'LRT', PH: 'LRT', KJ: 'LRT', SA: 'LRT', KGL: 'MRT', PYL: 'MRT', MR: 'Monorail', BRT: 'BRT',
}

type Props = {
  data: TransitData
  stationId: string
  now: Date
  onPickLine: (lineId: string) => void
  onClose: () => void
}

export default function StationCard({ data, stationId, now, onPickLine, onClose }: Props) {
  const station = data.stations.find(s => s.id === stationId)
  if (!station) return null
  const lines = linesAt(data, stationId)
  const modes = [...new Set(lines.map(l => MODE[l.id] ?? 'Rail'))]
  const meta = [...modes, `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`].join(' · ')

  return (
    <section className="place-card transit-card" aria-label={`Station ${station.name}`}>
      <button className="place-card__close" onClick={onClose} aria-label="Close">×</button>
      <h2 className="place-card__name">{station.name}</h2>
      <p className="place-card__meta">{meta}</p>
      <ul className="transit-lines">
        {lines.map(line => (
          <li key={line.id}>
            <button className="transit-line-row" onClick={() => onPickLine(line.id)}>
              <span className="transit-chip" style={{ background: line.colour }} aria-hidden="true" />
              <span className="transit-line-row__text">
                <span className="transit-line-row__name">{line.name}</span>
                <span className="transit-line-row__ends">{termini(line)}</span>
              </span>
              <span className="transit-line-row__status">{status(line, stationId, now)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="transit-caption">Scheduled times</p>
    </section>
  )
}

/** "Gombak ⇄ Putra Heights": each direction's headsign is the terminus it heads to. */
function termini(line: Line): string {
  const ends = line.directions.map(d => d.headsign)
  return ends.length === 2 ? `${ends[1]} ⇄ ${ends[0]}` : ends[0] ?? ''
}

function status(line: Line, stationId: string, now: Date): string {
  const s = departureStatus(line, stationId, now)
  if (!s) return ''
  return s.open ? `every ${s.everyMin} min` : `Closed · opens ${formatClock(s.opensAt)}`
}
