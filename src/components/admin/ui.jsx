import { useEffect, useState } from 'react'
import { orderStage } from '../../lib/orderFlow'

export function StagePill({ order }) {
  const s = orderStage(order)
  return <span className={`pill pill-${s.tone}`}>{s.label}</span>
}

export function ActivePill({ active, on = 'Active', off = 'Deactivated' }) {
  return <span className={`pill ${active ? 'pill-success' : 'pill-danger'}`}>{active ? on : off}</span>
}

/** Search box that waits until typing pauses before calling onSearch. */
export function SearchBox({ value, onSearch, placeholder, label }) {
  const [term, setTerm] = useState(value ?? '')
  const [synced, setSynced] = useState(value ?? '')
  if ((value ?? '') !== synced) {
    setSynced(value ?? '')
    setTerm(value ?? '')
  }

  useEffect(() => {
    if (term === (value ?? '')) return
    const t = setTimeout(() => onSearch(term.trim()), 350)
    return () => clearTimeout(t)
  }, [term, value, onSearch])

  return (
    <form
      className="search admin-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(term.trim())
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input type="search" placeholder={placeholder} aria-label={label ?? placeholder} value={term} onChange={(e) => setTerm(e.target.value)} />
    </form>
  )
}

/** Filter chips bound to a key. */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`chip ${o.key === value ? 'is-active' : ''}`}
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A button that asks "Are you sure?" inline before running `onConfirm`. */
export function ConfirmButton({ label, confirmText, confirmLabel, onConfirm, danger = false, className = '' }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!asking) {
    return (
      <button type="button" className={`btn ${danger ? 'btn-ghost danger-text' : 'btn-primary'} ${className}`} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className={`confirm-box ${danger ? '' : 'confirm-ok'}`} role="group" aria-label={`Confirm: ${label}`}>
      <p>{confirmText}</p>
      <div className="row gap wrap">
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onConfirm()
            setBusy(false)
            setAsking(false)
          }}
        >
          {busy ? 'Saving…' : confirmLabel ?? `Yes, ${label.toLowerCase()}`}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Plain responsive table: turns into stacked cards on small screens (uses .table styles). */
export function DataTable({ columns, rows, rowKey, empty }) {
  if (!rows.length) return <p className="muted">{empty}</p>
  return (
    <div className="table-wrap">
      <table className="table admin-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className={c.num ? 'num' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.label} data-label={c.label} className={c.num ? 'num' : ''}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
