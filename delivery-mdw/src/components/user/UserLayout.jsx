import { Suspense, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CartProvider, useCart } from '../../context/CartContext'

const icons = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  shops: <path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />,
  cart: (
    <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2M9.5 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01" />
  ),
  orders: <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
}

function Tabs() {
  const { count } = useCart()
  const tabs = [
    { to: '/user', label: 'Home', icon: 'home', end: true },
    { to: '/user/shops', label: 'Shops', icon: 'shops' },
    { to: '/user/cart', label: 'Cart', icon: 'cart', badge: count },
    { to: '/user/orders', label: 'Orders', icon: 'orders' },
    { to: '/user/profile', label: 'Profile', icon: 'profile' },
  ]

  return (
    <nav className="user-tabs" aria-label="Customer">
      <div className="container user-tabs-inner">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="user-tab">
            <span className="user-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {icons[t.icon]}
              </svg>
              {t.badge > 0 && <span className="tab-badge">{t.badge > 99 ? '99+' : t.badge}</span>}
            </span>
            <span className="user-tab-label">
              {t.label}
              {t.badge > 0 && <span className="sr-only"> ({t.badge} items)</span>}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function UserLayout() {
  // Leaves room for the fixed bottom tab bar on phones.
  useEffect(() => {
    document.body.classList.add('has-tabbar')
    return () => document.body.classList.remove('has-tabbar')
  }, [])

  return (
    <CartProvider>
      <Tabs />
      <div className="user-page">
        <Suspense fallback={<div className="page-loading"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading…</span></div>}>
          <Outlet />
        </Suspense>
      </div>
    </CartProvider>
  )
}
