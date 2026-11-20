import { useEffect, useRef } from 'react'
import { stopIndex } from './lookup'
import { formatClock, stationStatus } from './schedule'
import type { TransitData } from './types'
import './transit.css'

type Props = {
  data: TransitData
  lineId: string
  dir: 0 | 1
  stationId: string
  now: Date
  onPickStop: (stationId: string) => void
  onSwapDir: () => void
  onBack: () => void
  onClose: () => void
}

export default function LineCard({ data, lineId, dir, stationId, now, onPickStop, onSwapDir, onBack, onClose }: Props) {
  const currentRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [lineId, dir, stationId])

  const line = data.lines.find(l => l.id === lineId)
  const direction = line?.directions.find(d => d.dir === dir)
  if (!line || !direction) return null
  const here = stopIndex(direction, stationId)
  const hereOffset = here >= 0 ? direction.stops[here].offsetS : 0
  const status = here >= 0 ? stationStatus(direction, stationId, now) : null
  const nameOf = (id: string) => data.stations.find(s => s.id === id)?.name ?? id

  return (
    <section
      className="place-card transit-card"
      aria-label={`${line.name} towards ${direction.headsign}`}
      style={{ '--line-colour': line.colour } as React.CSSProperties}
    >
      <button className="place-card__close" onClick={onClose} aria-label="Close">×</button>
      <div className="transit-line-head">
        <button className="transit-back" onClick={onBack} aria-label="Back to station">←</button>
        <h2 className="place-card__name transit-line-head__name">{line.name}</h2>
      </div>
      <div className="transit-dir">
        <span>To {direction.headsign}</span>
        <button className="transit-swap" onClick={onSwapDir} aria-label="Swap direction" title="Swap direction">⇄</button>
      </div>
      {status && (
        <p className="place-card__meta transit-status">
          {status.open
            ? `every ${status.everyMin} min now · last train ${formatClock(status.last)}`
            : `Closed · opens ${formatClock(status.opensAt)}`}
        </p>
      )}
      <ol className="transit-stops">
        {direction.stops.map((stop, i) => {
          const isHere = i === here
          const behind = here >= 0 && i < here
          const mins = Math.round((stop.offsetS - hereOffset) / 60)
          return (
            <li
              key={stop.stationId}
              ref={isHere ? currentRef : undefined}
              className={`transit-stop${isHere ? ' transit-stop--here' : ''}${behind ? ' transit-stop--behind' : ''}`}
            >
              <button className="transit-stop__btn" onClick={() => onPickStop(stop.stationId)}>
                <span className="transit-stop__dot" aria-hidden="true" />
                <span className="transit-stop__name">{nameOf(stop.stationId)}</span>
                <span className="transit-stop__time">
                  {isHere ? "you're here" : !behind && here >= 0 ? `+${mins} min` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="transit-caption">Scheduled times</p>
    </section>
  )
}
