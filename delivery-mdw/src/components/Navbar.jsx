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
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M7 20V11h10v9M17 14h4l3 3v3h-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="11" cy="21.5" r="2" fill="#fff" />
              <circle cx="21" cy="21.5" r="2" fill="#fff" />
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
