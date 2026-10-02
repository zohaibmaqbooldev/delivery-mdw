import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath, roleLabel } from '../lib/roles'

export default function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname])

  async function handleLogout() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    navigate('/', { replace: true })
  }

  const signedIn = Boolean(user && role)

  return (
    <header className={`navbar ${role === 'admin' ? 'navbar-admin' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="Delivery MDW home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="32" height="32" role="img" aria-label="Delivery MDW logo">
              <defs>
                <linearGradient id="brandGradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ff9a4d" />
                  <stop offset="100%" stopColor="#ff6a00" />
                </linearGradient>
              </defs>
              <path d="M24 4c-8.7 0-15.8 7.1-15.8 15.8 0 11.6 15.8 23.8 15.8 23.8S39.8 31.4 39.8 19.8C39.8 11.1 32.7 4 24 4Z" fill="url(#brandGradient)" />
              <path d="M24 11.6c-4.5 0-8.1 3.6-8.1 8.1s3.6 8.1 8.1 8.1 8.1-3.6 8.1-8.1-3.6-8.1-8.1-8.1Z" fill="#fff" opacity="0.95" />
              <path d="M15.2 29.3 22.7 23l5.1 5.1 6.8-9.4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30.8 15.2h5.3l2.8 3.6v4.8h-8.1" fill="none" stroke="#ff7a1a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.8 34.8h6.7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            Delivery <strong>MDW</strong>
          </span>
        </Link>

        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="main-nav" className={`nav-links ${open ? 'is-open' : ''}`}>
          {signedIn ? (
            <>
              <NavLink to={dashboardPath(role)} className="nav-link">
                Dashboard
              </NavLink>
              <span className="nav-user" title={profile?.email}>
                <span className="nav-user-name">{profile?.name || profile?.email}</span>
                <span className={`badge badge-${role}`}>{roleLabel(role)}</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout} disabled={signingOut}>
                {signingOut ? 'Logging out…' : 'Log out'}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/" end className="nav-link">
                Home
              </NavLink>
              <NavLink to="/login" className="nav-link">
                Log in
              </NavLink>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
