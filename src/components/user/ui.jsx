import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DELIVERY_STATUS, ORDER_STATUS, formatPrice } from '../../lib/format'

const TILE_COLORS = ['#0f766e', '#1d5b8f', '#8a5300', '#5b2a9e', '#b42318', '#2f6b3a', '#7a4b1f']

function colorFor(text) {
  let h = 0
  for (const ch of text ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TILE_COLORS[h % TILE_COLORS.length]
}

function initials(text) {
  return (text ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/** Shows the image if there is one, otherwise a coloured tile with initials. */
export function ImageTile({ src, name, className = '' }) {
  const [broken, setBroken] = useState(false)
  if (src && !broken) {
    return (
      <img className={`image-tile ${className}`} src={src} alt={name} loading="lazy" onError={() => setBroken(true)} />
    )
  }
  return (
    <div className={`image-tile image-tile-fallback ${className}`} style={{ background: colorFor(name) }} role="img" aria-label={name}>
      <span>{initials(name)}</span>
    </div>
  )
}

export function OpenBadge({ isOpen }) {
  return <span className={`pill ${isOpen ? 'pill-success' : 'pill-neutral'}`}>{isOpen ? 'Open' : 'Closed'}</span>
}

export function OrderStatusBadge({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: 'neutral' }
  return <span className={`pill pill-${s.tone}`}>{s.label}</span>
}

export function DeliveryStatusBadge({ status }) {
  const s = DELIVERY_STATUS[status] ?? { label: status, tone: 'neutral' }
  return <span className={`pill pill-${s.tone}`}>{s.label}</span>
}

export function ShopCard({ shop }) {
  return (
    <article className="card shop-card">
      <ImageTile src={shop.image_url} name={shop.name} className="shop-card-img" />
      <div className="shop-card-body">
        <div className="shop-card-top">
          <h3 className="shop-card-name">{shop.name}</h3>
          <OpenBadge isOpen={shop.is_open} />
        </div>
        <p className="shop-card-loc muted">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          {shop.location || 'Location not set'}
        </p>
        <p className="shop-card-fee muted">
          Delivery {Number(shop.delivery_fee) > 0 ? formatPrice(shop.delivery_fee) : 'free'}
        </p>
        <Link to={`/user/shops/${shop.id}`} className="btn btn-outline btn-sm btn-block">
          View Shop
        </Link>
      </div>
    </article>
  )
}

export function QuantityStepper({ value, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= 99} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}

export function PageHeader({ title, subtitle, back, children }) {
  return (
    <header className="page-head">
      {back && (
        <Link to={back.to} className="back-link">
          ← {back.label}
        </Link>
      )}
      <div className="page-head-row">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  )
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="card empty-block">
      <h2 className="h3">{title}</h2>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

/*
 * Error messages shown to people. Known Supabase Auth / network / database messages are
 * translated; our own database checks already raise plain-language messages (they pass
 * through); anything else that looks technical is replaced by a generic message so
 * internal details (SQL, constraint names, stack traces) are never shown.
 */
const AUTH_MESSAGES = [
  [/invalid login credentials/i, 'Incorrect email or password.'],
  [/email not confirmed/i, 'Please confirm your email address first — check your inbox for the link.'],
  [/user already registered|already been registered/i, 'An account with this email already exists. Try logging in instead.'],
  [/unable to validate email|invalid format|email address .* is invalid/i, 'Please enter a valid email address.'],
  [/password should be at least|password is too short|weak password|password.*(characters|strength)/i, 'Please choose a stronger password (at least 8 characters, letters and numbers).'],
  [/same password|different from the old/i, 'Your new password must be different from the old one.'],
  [/rate limit|too many requests|over_request_rate_limit|over_email_send_rate_limit|429/i, 'Too many attempts. Please wait a few minutes and try again.'],
  [/signups? not allowed|signup is disabled/i, 'New sign-ups are currently turned off.'],
  [/auth session missing|refresh token|session.*(expired|not found)|jwt expired|invalid jwt|jwt/i, 'Your session has expired. Please log in again.'],
]
const TECHNICAL = /violates|constraint|syntax|relation|column|function|schema|pgrst|null value|uuid|operator|policy|sql|duplicate key|could not|unexpected|undefined|typeerror|exception|stack|internal/i

export function friendlyError(message) {
  const m = String(message ?? '').trim()
  if (!m) return 'Something went wrong. Please try again.'
  if (/failed to fetch|networkerror|network request failed|load failed|econn|fetch failed|timed? ?out|bad gateway|\b50[234]\b/i.test(m))
    return "Couldn't reach the server. Check your internet connection and try again."
  for (const [re, text] of AUTH_MESSAGES) if (re.test(m)) return text
  if (/permission denied|row-level security|not authorized|admins only/i.test(m)) return "You don't have permission to do that."
  if (/duplicate key|already exists/i.test(m)) return 'That already exists.'
  if (/check constraint|violates check/i.test(m)) return 'Some of the details are not valid. Please check and try again.'
  if (TECHNICAL.test(m) || m.length > 200) return 'Something went wrong. Please try again.'
  return m
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="alert alert-error" role="alert">
      {friendlyError(message)}
      {onRetry && (
        <button className="link-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  )
}
