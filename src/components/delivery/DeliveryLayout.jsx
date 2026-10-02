import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { RiderProvider, useRider } from '../../context/RiderContext'
import { ErrorState, Skeleton, friendlyError } from '../user/ui'

const icons = {
  dashboard: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z" />,
  orders: <path d="M3 16V7h10v9M13 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
}

const tabs = [
  { to: '/delivery', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/delivery/orders', label: 'My Deliveries', icon: 'orders' },
  { to: '/delivery/profile', label: 'Profile', icon: 'profile' },
]

function Tabs() {
  return (
    <nav className="user-tabs" aria-label="Delivery">
      <div className="container user-tabs-inner">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="user-tab">
            <span className="user-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {icons[t.icon]}
              </svg>
            </span>
            <span className="user-tab-label">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Waits for the delivery boy's details row before showing a page. */
export function RequireRider({ children }) {
  const { loading, error, rider, refresh } = useRider()
  if (loading) {
    return (
      <div className="container user-content">
        <Skeleton rows={3} />
      </div>
    )
  }
  if (error || !rider) {
    return (
      <div className="container user-content">
        <ErrorState message={error || 'Could not load your delivery details.'} onRetry={refresh} />
      </div>
    )
  }
  return children
}

/** Shown instead of deliveries until an admin approves this delivery account. */
export function AwaitingApproval({ profileLink = false }) {
  return (
    <section className="card approval-card" role="status">
      <span className="strong d-block">Your delivery account is waiting for admin approval</span>
      <span className="muted small">
        You can't go online or see any orders until an admin approves your account. Meanwhile, complete your profile — add your phone
        number and vehicle so the admin can verify you.
      </span>
      {profileLink && (
        <Link to="/delivery/profile" className="btn btn-outline btn-sm approval-link">
          Complete your profile
        </Link>
      )}
    </section>
  )
}

/** Wraps order pages: unapproved delivery boys see the approval notice instead. (The database also refuses them.) */
export function RequireApproval({ children }) {
  const { rider } = useRider()
  if (!rider?.is_approved) {
    return (
      <div className="container user-content">
        <AwaitingApproval profileLink />
      </div>
    )
  }
  return children
}

/** Online / offline switch used on the dashboard and profile. */
export function OnlineToggle() {
  const { rider, setOnline } = useRider()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setSaving(true)
    setError('')
    const err = await setOnline(!rider.is_online)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <section className={`card online-card ${rider.is_online ? 'is-online' : ''}`}>
      <div className="online-info">
        <span className={`online-dot ${rider.is_online ? 'on' : ''}`} aria-hidden="true" />
        <div>
          <span className="strong d-block">{rider.is_online ? 'You are online' : 'You are offline'}</span>
          <span className="muted small">
            {rider.is_online
              ? 'New orders can be assigned to you.'
              : 'Go online to receive orders. Orders you haven’t accepted are handed to someone else.'}
          </span>
        </div>
      </div>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={rider.is_online} onChange={toggle} disabled={saving || !rider.is_approved} aria-label="Online" />
        <span className="switch" aria-hidden="true" />
        <span>{saving ? 'Saving…' : rider.is_online ? 'Online' : 'Offline'}</span>
      </label>
      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
    </section>
  )
}

export default function DeliveryLayout() {
  useEffect(() => {
    document.body.classList.add('has-tabbar')
    return () => document.body.classList.remove('has-tabbar')
  }, [])

  return (
    <RiderProvider>
      <Tabs />
      <div className="user-page">
        <Suspense fallback={<div className="page-loading"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading…</span></div>}>
          <Outlet />
        </Suspense>
      </div>
    </RiderProvider>
  )
}
