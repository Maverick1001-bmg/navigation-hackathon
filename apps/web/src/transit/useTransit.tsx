import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LngLatBounds, type Map as MapLibreMap, type PaddingOptions } from 'maplibre-gl'
import type { Place } from '../photon'
import rapidRail from './rapidRail.json'
import { addTransitLayer, type TransitLayer } from './transitLayer'
import { defaultDir, stationForPlace, stopIndex } from './lookup'
import StationCard from './StationCard'
import LineCard from './LineCard'
import type { TransitData } from './types'

const data = rapidRail as TransitData
const STATION_ZOOM = 14

type TransitSelection =
  | { kind: 'none' }
  | { kind: 'station'; stationId: string }
  | { kind: 'line'; lineId: string; dir: 0 | 1; stationId: string }

type Options = {
  /** Called when a transit card opens from nothing (App hides the place card). */
  onOpen: () => void
  /** A station dot was tapped with no transit card open: App shows the place card first. */
  onStationPlace: (place: Place) => void
  fitPadding: () => PaddingOptions
}

export function useTransit(map: MapLibreMap | null, opts: Options) {
  const [selection, setSelectionState] = useState<TransitSelection>({ kind: 'none' })
  const [now, setNow] = useState(() => new Date())
  const selectionRef = useRef(selection)
  const optsRef = useRef(opts)
  const layerRef = useRef<TransitLayer | null>(null)

  const setSelection = useCallback((next: TransitSelection) => {
    if (selectionRef.current.kind === 'none' && next.kind !== 'none') {
      optsRef.current.onOpen()
      setNow(new Date())
    }
    selectionRef.current = next
    setSelectionState(next)
  }, [])

  const openStation = useCallback(
    (stationId: string) => {
      const station = data.stations.find(s => s.id === stationId)
      if (!station) return
      setSelection({ kind: 'station', stationId })
      map?.easeTo({ center: [station.lng, station.lat], zoom: Math.max(map.getZoom(), STATION_ZOOM) })
    },
    [map, setSelection],
  )

  const openLine = useCallback(
    (lineId: string, stationId: string) => {
      const line = data.lines.find(l => l.id === lineId)
      if (!line) return
      const dir = defaultDir(line, stationId)
      setSelection({ kind: 'line', lineId, dir, stationId })
      const shape = line.directions.find(d => d.dir === dir)?.shape ?? []
      if (map && shape.length) {
        const bounds = new LngLatBounds()
        for (const p of shape) bounds.extend(p)
        map.fitBounds(bounds, { padding: linePadding(optsRef.current.fitPadding), duration: 600 })
      }
    },
    [map, setSelection],
  )

  // Station dot clicked on the map
  const onStationClick = useCallback(
    (stationId: string) => {
      const sel = selectionRef.current
      if (sel.kind === 'line') {
        const line = data.lines.find(l => l.id === sel.lineId)
        const direction = line?.directions.find(d => d.dir === sel.dir)
        if (direction && stopIndex(direction, stationId) >= 0) {
          setSelection({ ...sel, stationId }) // "you're here" moves, camera stays
          return
        }
      }
      if (sel.kind === 'none') {
        // Place card (with Directions) first; its "Public transport" button opens the station card
        const place = placeForStation(stationId)
        if (place) {
          optsRef.current.onStationPlace(place)
          return
        }
      }
      openStation(stationId)
    },
    [openStation, setSelection],
  )
  const onStationClickRef = useRef(onStationClick)
  useEffect(() => {
    optsRef.current = opts
    onStationClickRef.current = onStationClick
  })

  // Layer lifecycle
  useEffect(() => {
    if (!map) return
    const layer = addTransitLayer(map, data, id => onStationClickRef.current(id))
    layerRef.current = layer
    syncLayer(layer, selectionRef.current)
    return () => {
      layerRef.current = null
      layer.remove()
    }
  }, [map])

  // Keep the map in sync with the selection
  useEffect(() => {
    if (layerRef.current) syncLayer(layerRef.current, selection)
  }, [selection])

  // Refresh "every N min now" while a card is open
  useEffect(() => {
    if (selection.kind === 'none') return
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [selection.kind])

  const close = useCallback(() => setSelection({ kind: 'none' }), [setSelection])

  /** Id of the rail station a place refers to, if any. */
  const stationIdForPlace = useCallback((place: Place) => stationForPlace(data, place)?.id ?? null, [])

  let card: ReactNode = null
  if (selection.kind === 'station') {
    card = (
      <StationCard
        data={data}
        stationId={selection.stationId}
        now={now}
        onPickLine={lineId => openLine(lineId, selection.stationId)}
        onShowPlace={() => {
          const place = placeForStation(selection.stationId)
          if (place) opts.onStationPlace(place)
        }}
        onClose={close}
      />
    )
  } else if (selection.kind === 'line') {
    card = (
      <LineCard
        data={data}
        lineId={selection.lineId}
        dir={selection.dir}
        stationId={selection.stationId}
        now={now}
        onPickStop={stationId => setSelection({ ...selection, stationId })}
        onSwapDir={() => setSelection({ ...selection, dir: selection.dir === 0 ? 1 : 0 })}
        onBack={() => setSelection({ kind: 'station', stationId: selection.stationId })}
        onClose={close}
      />
    )
  }

  return { card, stationIdForPlace, openStation, close }
}

/** A station as a place, so it gets the normal place card (with Directions). */
function placeForStation(stationId: string): Place | null {
  const s = data.stations.find(x => x.id === stationId)
  if (!s) return null
  const lines = data.lines.filter(l => s.lineIds.includes(l.id)).map(l => l.shortName)
  return {
    id: `station-${s.id}`,
    name: s.name,
    detail: lines.join(' · '),
    category: 'Station',
    lng: s.lng,
    lat: s.lat,
    distanceM: 0,
  }
}

/** On phones the line card is a bottom sheet (max 55vh): keep the line above it. */
function linePadding(desktop: () => PaddingOptions): PaddingOptions {
  if (window.innerWidth >= 700) return desktop()
  return { top: 70, bottom: Math.round(window.innerHeight * 0.55) + 20, left: 30, right: 50 }
}

function syncLayer(layer: TransitLayer, sel: TransitSelection) {
  if (sel.kind === 'line') layer.setHighlight(sel.lineId, sel.dir)
  else layer.setHighlight(null, 0)
  layer.setSelectedStation(sel.kind === 'none' ? null : sel.stationId)
}
