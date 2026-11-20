import { Marker, Popup, type Map as MapLibreMap } from 'maplibre-gl'
import { timeAgo, type Incident, type IncidentType } from './api'

// Incident markers (red, emoji per type). DOM markers so emoji render on every phone.
// Tapping one opens a popup with a "Still there 👍" confirm button.

export const INCIDENT_INFO: Record<IncidentType, { emoji: string; label: string; icon: string }> = {
  jam: { emoji: '🚗', label: 'Traffic jam', icon: '/icons/jam.webp' },
  accident: { emoji: '💥', label: 'Accident', icon: '/icons/accident.webp' },
  police: { emoji: '🚓', label: 'Police', icon: '/icons/police.webp' },
  flood: { emoji: '🌊', label: 'Flood', icon: '/icons/flood.webp' },
  roadworks: { emoji: '🚧', label: 'Roadworks', icon: '/icons/roadworks.webp' },
  hazard: { emoji: '⚠️', label: 'Hazard', icon: '/icons/hazard.webp' },
}

type Entry = { marker: Marker; el: HTMLDivElement; incident: Incident }

export function createIncidentMarkers(map: MapLibreMap, onConfirm: (id: string) => void) {
  const entries = new Map<string, Entry>()
  let onRoute = new Set<string>()

  const popupContent = (i: Incident) => {
    const info = INCIDENT_INFO[i.type] ?? INCIDENT_INFO.hazard
    const root = document.createElement('div')
    root.className = 'incident-popup'
    const title = document.createElement('strong')
    title.textContent = `${info.emoji} ${info.label}`
    const meta = document.createElement('span')
    meta.className = 'incident-popup__meta'
    meta.textContent = `${timeAgo(i.reportedAt)} · ${i.confirmations} confirmed`
    root.append(title, meta)
    if (i.note) {
      const note = document.createElement('p') // textContent: notes come from other users
      note.textContent = i.note
      root.append(note)
    }
    const btn = document.createElement('button')
    btn.className = 'incident-popup__btn'
    btn.textContent = 'Still there 👍'
    btn.addEventListener('click', () => {
      btn.disabled = true
      btn.textContent = 'Thanks!'
      onConfirm(i.id)
    })
    root.append(btn)
    return root
  }

  const style = (e: Entry) => {
    e.el.classList.toggle('incident-marker--on-route', onRoute.has(e.incident.id))
    e.el.title = INCIDENT_INFO[e.incident.type]?.label ?? 'Incident'
  }

  return {
    /** Replace the shown incidents (adds new, updates changed, removes gone). */
    set(incidents: Incident[]) {
      const seen = new Set<string>()
      for (const i of incidents) {
        seen.add(i.id)
        const existing = entries.get(i.id)
        if (existing) {
          existing.incident = i
          existing.marker.setLngLat([i.location.lng, i.location.lat])
          const popup = existing.marker.getPopup()
          if (popup && !popup.isOpen()) popup.setDOMContent(popupContent(i))
          style(existing)
          continue
        }
        const el = document.createElement('div')
        el.className = 'incident-marker'
        const icon = document.createElement('img')
        icon.src = (INCIDENT_INFO[i.type] ?? INCIDENT_INFO.hazard).icon
        icon.alt = ''
        el.append(icon)
        const marker = new Marker({ element: el })
          .setLngLat([i.location.lng, i.location.lat])
          .setPopup(new Popup({ offset: 18, closeButton: true, maxWidth: '240px' }).setDOMContent(popupContent(i)))
          .addTo(map)
        const entry = { marker, el, incident: i }
        style(entry)
        entries.set(i.id, entry)
      }
      for (const [id, e] of entries) {
        if (!seen.has(id)) {
          e.marker.remove()
          entries.delete(id)
        }
      }
    },
    /** Highlight incidents that lie on the current route. */
    setOnRoute(ids: string[]) {
      onRoute = new Set(ids)
      for (const e of entries.values()) style(e)
    },
    remove() {
      for (const e of entries.values()) e.marker.remove()
      entries.clear()
    },
  }
}

export type IncidentMarkers = ReturnType<typeof createIncidentMarkers>
