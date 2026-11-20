import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistance, searchPlaces, type Place, type SearchEntry } from './photon'

type Props = {
  /** Where to bias results and measure distance from (map centre / user location). */
  getBias: () => { lng: number; lat: number }
  onSelect: (place: Place) => void
  onClear: () => void
}

const MIN_CHARS = 3
const DEBOUNCE_MS = 300
const BRANCHES_SHOWN = 3 // per chain, before "Show N more"

type Status = 'idle' | 'loading' | 'error' | 'done'

// One line in the dropdown. Only 'place' and 'more' rows can be selected.
type Row =
  | { kind: 'header'; key: string; name: string; category: string; count: number }
  | { kind: 'place'; key: string; place: Place; branch: boolean }
  | { kind: 'more'; key: string; groupKey: string; hidden: number }

function toRows(entries: SearchEntry[], expanded: Set<string>): Row[] {
  const rows: Row[] = []
  for (const e of entries) {
    if (e.kind === 'place') {
      rows.push({ kind: 'place', key: e.place.id, place: e.place, branch: false })
      continue
    }
    rows.push({ kind: 'header', key: `h:${e.key}`, name: e.name, category: e.category, count: e.places.length })
    const visible = expanded.has(e.key) ? e.places : e.places.slice(0, BRANCHES_SHOWN)
    for (const p of visible) rows.push({ kind: 'place', key: p.id, place: p, branch: true })
    const hidden = e.places.length - visible.length
    if (hidden > 0) rows.push({ kind: 'more', key: `m:${e.key}`, groupKey: e.key, hidden })
  }
  return rows
}

export default function SearchBox({ getBias, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // index into selectable rows
  const skipSearchFor = useRef<string | null>(null) // don't re-search the name we just picked
  const getBiasRef = useRef(getBias)
  getBiasRef.current = getBias

  const rows = useMemo(() => toRows(entries, expanded), [entries, expanded])
  const selectable = useMemo(() => rows.filter(r => r.kind !== 'header'), [rows])

  useEffect(() => {
    const q = query.trim()
    if (q === skipSearchFor.current) return
    if (q.length < MIN_CHARS) {
      setEntries([])
      setStatus('idle')
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setStatus('loading')
      try {
        const found = await searchPlaces(q, getBiasRef.current(), ctrl.signal)
        setEntries(found)
        setExpanded(new Set())
        setActive(found.length ? 0 : -1)
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

  const activate = (row: Row | undefined) => {
    if (!row) return
    if (row.kind === 'place') choose(row.place)
    if (row.kind === 'more') setExpanded(prev => new Set(prev).add(row.groupKey))
  }

  const clear = () => {
    skipSearchFor.current = null
    setQuery('')
    setEntries([])
    setOpen(false)
    onClear()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(i => Math.min(i + 1, selectable.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      activate(selectable[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && query.trim().length >= MIN_CHARS
  const activeKey = selectable[active]?.key

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
          onFocus={() => entries.length && setOpen(true)}
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
          {status === 'done' && rows.length === 0 && <li className="search__msg">No places found.</li>}
          {rows.map(row => {
            if (row.kind === 'header') {
              return (
                <li key={row.key} className="search__group" role="presentation">
                  <span className="search__name">{row.name}</span>
                  <span className="search__detail">
                    {[row.category, `${row.count} locations`].filter(Boolean).join(' · ')}
                  </span>
                </li>
              )
            }
            const isActive = row.key === activeKey
            const select = () => setActive(selectable.findIndex(r => r.key === row.key))
            if (row.kind === 'more') {
              return (
                <li
                  key={row.key}
                  role="option"
                  aria-selected={isActive}
                  className={`search__item search__item--branch search__more${isActive ? ' is-active' : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => activate(row)}
                  onMouseEnter={select}
                >
                  Show {row.hidden} more
                </li>
              )
            }
            const p = row.place
            return (
              <li
                key={row.key}
                role="option"
                aria-selected={isActive}
                className={`search__item${row.branch ? ' search__item--branch' : ''}${isActive ? ' is-active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => activate(row)}
                onMouseEnter={select}
              >
                <span className="search__text">
                  {/* Branches show their area as the main line; the chain name is in the header */}
                  <span className="search__name">{row.branch ? p.detail || p.name : p.name}</span>
                  {!row.branch && (p.detail || p.category) && (
                    <span className="search__detail">{[p.category, p.detail].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <span className="search__dist">{formatDistance(p.distanceM)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
