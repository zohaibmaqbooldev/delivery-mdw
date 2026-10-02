import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatOrderNumber, formatPrice } from '../../lib/format'
import { DataTable, StagePill } from '../../components/admin/ui'
import { ErrorState, Skeleton } from '../../components/user/ui'

// Admin Dashboard — /admin
export default function AdminDashboard() {
  const [state, setState] = useState({ loading: true, error: '', stats: null, recent: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const [stats, recent] = await Promise.all([
      supabase.rpc('admin_dashboard_stats').single(),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, shop_name, total, status, delivery_status, delivery_boy_id, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ])
    const error = stats.error || recent.error
    setState({ loading: false, error: error ? error.message : '', stats: stats.data, recent: recent.data ?? [] })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { loading, error, stats, recent } = state
  const v = (n) => (loading ? '…' : stats ? n ?? 0 : '—')
  const cards = [
    { label: 'Total Users', value: v(stats?.total_users), to: '/admin/users?role=user', hint: 'Customer accounts' },
    {
      label: 'Total Shops',
      value: v(stats?.total_shops),
      to: '/admin/shops',
      hint: stats?.shops_awaiting_approval ? `${stats.shops_awaiting_approval} awaiting approval` : 'All approved',
    },
    {
      label: 'Total Delivery Boys',
      value: v(stats?.total_delivery_boys),
      to: stats?.delivery_boys_awaiting_approval ? '/admin/delivery?show=pending' : '/admin/delivery',
      hint: stats?.delivery_boys_awaiting_approval ? `${stats.delivery_boys_awaiting_approval} awaiting approval` : 'All approved',
    },
    { label: 'Total Orders', value: v(stats?.total_orders), to: '/admin/orders' },
    { label: 'Pending Orders', value: v(stats?.pending_orders), to: '/admin/orders?stage=pending', hint: 'Waiting for the shop' },
    { label: 'Completed Orders', value: v(stats?.completed_orders), to: '/admin/orders?stage=delivered', hint: 'Delivered' },
    { label: 'Total Sales', value: loading ? '…' : stats ? formatPrice(stats.total_sales ?? 0) : '—', hint: 'Delivered orders' },
  ]

  return (
    <div className="admin-page">
      <header className="page-head">
        <p className="eyebrow">Admin</p>
        <div className="page-head-row">
          <h1 className="h1">Dashboard</h1>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="admin-stats">
        {cards.map((c) => {
          const body = (
            <>
              <span className="stat-label">{c.label}</span>
              <span className="stat-value">{c.value}</span>
              {c.hint && <span className="stat-hint">{c.hint}</span>}
            </>
          )
          return c.to ? (
            <Link key={c.label} to={c.to} className="card stat stat-link">
              {body}
            </Link>
          ) : (
            <div key={c.label} className="card stat">
              {body}
            </div>
          )
        })}
      </div>

      <section className="card block">
        <div className="block-head">
          <h2 className="h3">Recent orders</h2>
          <Link to="/admin/orders" className="see-all">
            All orders
          </Link>
        </div>
        {loading ? (
          <Skeleton rows={3} />
        ) : (
          <DataTable
            rows={recent}
            rowKey={(o) => o.id}
            empty="No orders yet."
            columns={[
              { label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.order_number)}</Link> },
              { label: 'Customer', render: (o) => o.customer_name || '—' },
              { label: 'Shop', render: (o) => o.shop_name },
              { label: 'Total', num: true, render: (o) => formatPrice(o.total) },
              { label: 'Date', render: (o) => formatDate(o.created_at, true) },
              { label: 'Status', render: (o) => <StagePill order={o} /> },
            ]}
          />
        )}
      </section>
    </div>
  )
}
