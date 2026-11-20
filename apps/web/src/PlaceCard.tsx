import { formatDistance, haversineM, type Place } from './photon'

type Props = {
  place: Place
  /** User's GPS position, if known. Distance is only shown when we have it. */
  userPos: { lng: number; lat: number } | null
  onClose: () => void
  onDirections: (place: Place) => void
  onShared: (message: string) => void
}

export default function PlaceCard({ place, userPos, onClose, onDirections, onShared }: Props) {
  const distance = userPos ? formatDistance(haversineM(userPos.lat, userPos.lng, place.lat, place.lng)) : null
  const meta = [place.category, distance && `${distance} away`].filter(Boolean).join(' · ')

  const share = async () => {
    const url = `https://www.openstreetmap.org/?mlat=${place.lat.toFixed(6)}&mlon=${place.lng.toFixed(6)}#map=18/${place.lat.toFixed(6)}/${place.lng.toFixed(6)}`
    const text = [place.name, place.detail].filter(Boolean).join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        onShared('Place link copied.')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') onShared('Could not share this place.')
    }
  }

  return (
    <section className="place-card" aria-label={`Details for ${place.name}`}>
      <button className="place-card__close" onClick={onClose} aria-label="Close">×</button>
      <h2 className="place-card__name">{place.name}</h2>
      {meta && <p className="place-card__meta">{meta}</p>}
      {place.detail && <p className="place-card__address">{place.detail}</p>}
      <div className="place-card__actions">
        <button className="place-card__btn place-card__btn--primary" onClick={() => onDirections(place)}>
          Directions
        </button>
        <button className="place-card__btn" onClick={share}>
          Share
        </button>
      </div>
    </section>
  )
}
