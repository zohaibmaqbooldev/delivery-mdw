import { Suspense, useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { MyShopProvider, useMyShop } from '../../context/MyShopContext'
import { EmptyState, ErrorState, Skeleton } from '../user/ui'

const icons = {
  dashboard: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z" />,
  orders: <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6" />,
  products: <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />,
  profile: <path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />,
}

const tabs = [
  { to: '/shop', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/shop/orders', label: 'Orders', icon: 'orders' },
  { to: '/shop/products', label: 'Products', icon: 'products' },
  { to: '/shop/profile', label: 'Shop profile', icon: 'profile' },
]

function Tabs() {
  return (
    <nav className="user-tabs" aria-label="Shop">
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

/** Tells the owner when customers can't see the shop (awaiting approval or disabled by admin). */
function ShopStatusNotice() {
  const { shop } = useMyShop()
  if (!shop) return null
  if (!shop.is_active) {
    return (
      <div className="container">
        <div className="alert alert-error status-notice" role="status">
          An administrator has disabled your shop. Customers can't see it or order from it.
        </div>
      </div>
    )
  }
  if (!shop.is_approved) {
    return (
      <div className="container">
        <div className="alert alert-warn status-notice" role="status">
          Your shop is waiting for admin approval. Customers will see it once it's approved. You can add products in
          the meantime.
        </div>
      </div>
    )
  }
  return null
}

/** Wrap pages that need the shop to exist. Shows a set-up prompt otherwise. */
export function RequireShop({ children }) {
  const { loading, error, shop, refresh } = useMyShop()
  if (loading) {
    return (
      <div className="container user-content">
        <Skeleton rows={3} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="container user-content">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    )
  }
  if (!shop) {
    return (
      <div className="container user-content">
        <EmptyState
          title="Set up your shop first"
          text="Add your shop's name, address and phone so customers can find you."
          action={
            <Link to="/shop/profile" className="btn btn-primary">
              Set up shop
            </Link>
          }
        />
      </div>
    )
  }
  return children
}

export default function ShopLayout() {
  useEffect(() => {
    document.body.classList.add('has-tabbar')
    return () => document.body.classList.remove('has-tabbar')
  }, [])

  return (
    <MyShopProvider>
      <Tabs />
      <ShopStatusNotice />
      <div className="user-page">
        <Suspense fallback={<div className="page-loading"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading…</span></div>}>
          <Outlet />
        </Suspense>
      </div>
    </MyShopProvider>
  )
}
