import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const icons = {
  dashboard: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z" />,
  users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3" />,
  shops: <path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />,
  delivery: <path d="M3 16V7h10v9M13 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01" />,
  orders: <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6" />,
  products: <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />,
  categories: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  logout: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />,
}

export const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/shops', label: 'Shops', icon: 'shops' },
  { to: '/admin/delivery', label: 'Delivery Boys', icon: 'delivery' },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' },
  { to: '/admin/products', label: 'Products', icon: 'products' },
  { to: '/admin/categories', label: 'Categories', icon: 'categories' },
  { to: '/admin/profile', label: 'Profile', icon: 'profile' },
]

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

function SidebarLinks({ onLogout, signingOut }) {
  return (
    <>
      <ul className="admin-nav-list">
        {ADMIN_LINKS.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end} className="admin-nav-link">
              <Icon name={l.icon} />
              <span>{l.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <button type="button" className="admin-nav-link admin-logout" onClick={onLogout} disabled={signingOut}>
        <Icon name="logout" />
        <span>{signingOut ? 'Logging out…' : 'Logout'}</span>
      </button>
    </>
  )
}

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const toggleRef = useRef(null)
  const drawerRef = useRef(null)

  const current =
    [...ADMIN_LINKS].sort((a, b) => b.to.length - a.to.length).find((l) => location.pathname.startsWith(l.to))?.label ?? 'Admin'

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [location.pathname])

  // Mobile menu: Esc closes, focus moves into the menu, page behind doesn't scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    drawerRef.current?.querySelector('a, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open])

  async function logout() {
    setSigningOut(true)
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="admin-shell">
      <div className="admin-mobilebar">
        <button
          ref={toggleRef}
          type="button"
          className="btn btn-ghost btn-sm admin-menu-btn"
          aria-expanded={open}
          aria-controls="admin-drawer"
          onClick={() => setOpen(true)}
        >
          <span className="admin-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Admin menu
        </button>
        <span className="admin-mobilebar-title">{current}</span>
      </div>

      <aside className="admin-sidebar" aria-label="Admin">
        <p className="admin-sidebar-title">Admin</p>
        <nav>
          <SidebarLinks onLogout={logout} signingOut={signingOut} />
        </nav>
      </aside>

      {open && <div className="admin-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div
        id="admin-drawer"
        ref={drawerRef}
        className={`admin-drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        hidden={!open}
      >
        <div className="admin-drawer-head">
          <span className="strong">Admin menu</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav>
          <SidebarLinks onLogout={logout} signingOut={signingOut} />
        </nav>
      </div>

      <div className="admin-main">
        <Suspense fallback={<div className="page-loading"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading…</span></div>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
