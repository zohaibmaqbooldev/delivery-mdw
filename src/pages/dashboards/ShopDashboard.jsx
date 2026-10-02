import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import { formatDate, formatOrderNumber, formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, OpenBadge, OrderStatusBadge, Skeleton } from '../../components/user/ui'

function Dashboard() {
  const { shop } = useMyShop()
  const [state, setState] = useState({ loading: true, error: '', stats: null, recent: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const [stats, recent] = await Promise.all([
      supabase.rpc('shop_dashboard_stats').single(),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, total, status, created_at')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    const error = stats.error || recent.error
    setState({ loading: false, error: error ? error.message : '', stats: stats.data, recent: recent.data ?? [] })
  }, [shop.id])

  useEffect(() => {
    load()
  }, [load])

  const { loading, error, stats, recent } = state
  const n = (v) => (stats ? v ?? 0 : '—')
  const cards = [
    { label: 'Total orders', value: n(stats?.total_orders) },
    { label: 'Pending orders', value: n(stats?.pending_orders), hint: 'Waiting for you to accept' },
    { label: 'Completed orders', value: n(stats?.completed_orders), hint: 'Ready, out for delivery or delivered' },
    { label: 'Total sales', value: stats ? formatPrice(stats.total_sales ?? 0) : '—', hint: 'From completed orders' },
  ]

  return (
    <div className="container user-content">
      <header className="page-head">
        <p className="eyebrow">Shop dashboard</p>
        <div className="page-head-row">
          <div>
            <h1 className="h1">{shop.name}</h1>
            <p className="muted row gap wrap">
              <OpenBadge isOpen={shop.is_open} />
              {!shop.is_active && <span className="pill pill-danger">Hidden by admin</span>}
              <Link to="/shop/profile">{shop.is_open ? 'Close shop' : 'Open shop'}</Link>
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="stats stats-4">
        {cards.map((c) => (
          <div key={c.label} className="card stat">
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{loading ? '…' : c.value}</span>
            {c.hint && <span className="stat-hint">{c.hint}</span>}
          </div>
        ))}
      </div>

      <section className="block">
        <div className="block-head">
          <h2 className="h2 block-title">Recent orders</h2>
          <Link to="/shop/orders" className="see-all">
            All orders
          </Link>
        </div>
        {loading ? (
          <Skeleton rows={3} />
        ) : recent.length === 0 ? (
          <EmptyState title="No orders yet" text="New orders from customers will appear here." />
        ) : (
          <ul className="order-list">
            {recent.map((o) => (
              <li key={o.id} className="card order-card">
                <div className="order-card-main">
                  <div className="order-card-top">
                    <span className="order-number">Order {formatOrderNumber(o.order_number)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <span className="order-shop">{o.customer_name || 'Customer'}</span>
                  <span className="muted small">{formatDate(o.created_at, true)}</span>
                </div>
                <div className="order-card-side">
                  <span className="order-total">{formatPrice(o.total)}</span>
                  <Link to={`/shop/orders/${o.id}`} className="btn btn-outline btn-sm">
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Shop Dashboard — /shop
export default function ShopDashboard() {
  return (
    <RequireShop>
      <Dashboard />
    </RequireShop>
  )
}
