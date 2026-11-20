import { useEffect, useRef, useState } from 'react'
import { searchPlaces, type Place } from './photon'

type Props = {
  /** Where to bias results (usually the map centre / user location). */
  getBias: () => { lng: number; lat: number }
  onSelect: (place: Place) => void
  onClear: () => void
}

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

type Status = 'idle' | 'loading' | 'error' | 'done'

export default function SearchBox({ getBias, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const skipSearchFor = useRef<string | null>(null) // don't re-search the name we just picked
  const getBiasRef = useRef(getBias)
  getBiasRef.current = getBias

  useEffect(() => {
    const q = query.trim()
    if (q === skipSearchFor.current) return
    if (q.length < MIN_CHARS) {
      setResults([])
      setStatus('idle')
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setStatus('loading')
      try {
        const places = await searchPlaces(q, getBiasRef.current(), ctrl.signal)
        setResults(places)
        setActive(places.length ? 0 : -1)
        setStatus('done')
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  const choose = (place: Place) => {
    skipSearchFor.current = place.name
    setQuery(place.name)
    setOpen(false)
    onSelect(place)
  }

  const clear = () => {
    skipSearchFor.current = null
    setQuery('')
    setResults([])
    setOpen(false)
    onClear()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && query.trim().length >= MIN_CHARS

  return (
    <div className="search" role="search">
      <div className="search__bar">
        <span className="search__icon" aria-hidden>⌕</span>
        <input
          className="search__input"
          type="search"
          placeholder="Search places in Malaysia"
          value={query}
          onChange={e => {
            skipSearchFor.current = null
            setQuery(e.target.value)
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-results"
          aria-autocomplete="list"
        />
        {status === 'loading' && <span className="search__spinner" aria-label="Searching" />}
        {query && (
          <button className="search__clear" onClick={clear} aria-label="Clear search">×</button>
        )}
      </div>

      {showList && (
        <ul className="search__results" id="search-results" role="listbox">
          {status === 'error' && <li className="search__msg">Search is unavailable right now.</li>}
          {status === 'done' && results.length === 0 && <li className="search__msg">No places found.</li>}
          {results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              className={`search__item${i === active ? ' is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search__name">{p.name}</span>
              {p.detail && <span className="search__detail">{p.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
