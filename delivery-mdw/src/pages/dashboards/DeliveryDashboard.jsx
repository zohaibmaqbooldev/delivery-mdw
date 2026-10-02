import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useRider } from '../../context/RiderContext'
import { OnlineToggle, RequireApproval, RequireRider } from '../../components/delivery/DeliveryLayout'
import DeliveryCard, { DELIVERY_LIST_FIELDS } from '../../components/delivery/DeliveryCard'
import usePolling from '../../lib/usePolling'
import { formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, Skeleton } from '../../components/user/ui'

const ACTIVE = ['assigned', 'accepted', 'picked_up', 'out_for_delivery']
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function Dashboard() {
  const { profile } = useAuth()
  const { rider } = useRider()
  const [state, setState] = useState({ loading: true, error: '', stats: null, active: [] })

  const load = useCallback(async () => {
    const [stats, active] = await Promise.all([
      supabase.rpc('delivery_dashboard_stats', { p_tz: timeZone }).single(),
      supabase
        .from('orders')
        .select(DELIVERY_LIST_FIELDS)
        .in('delivery_status', ACTIVE)
        .order('assigned_at', { ascending: true }),
    ])
    const error = stats.error || active.error
    setState({ loading: false, error: error ? error.message : '', stats: stats.data, active: active.data ?? [] })
  }, [])

  // Reload when going online/offline changes what's assigned.
  useEffect(() => {
    load()
  }, [load, rider.is_online])

  usePolling(load, 30000)

  const { loading, error, stats, active } = state
  const n = (v) => (stats ? v ?? 0 : '—')
  const cards = [
    { label: 'Assigned orders', value: n(stats?.assigned_orders), hint: 'Waiting for you to accept' },
    { label: 'Pending deliveries', value: n(stats?.pending_deliveries), hint: 'Accepted, not yet delivered' },
    { label: 'Completed deliveries', value: n(stats?.completed_deliveries), hint: 'All time' },
    { label: "Today's deliveries", value: n(stats?.today_deliveries) },
    { label: "Today's earnings", value: stats ? formatPrice(stats.today_earnings ?? 0) : '—', hint: 'Delivery fees' },
  ]
  const firstName = profile?.name?.split(' ')[0]

  return (
    <div className="container user-content">
      <header className="page-head">
        <p className="eyebrow">Delivery dashboard</p>
        <div className="page-head-row">
          <h1 className="h1">Hello{firstName ? `, ${firstName}` : ''}</h1>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      <OnlineToggle />

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="stats stats-5">
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
          <h2 className="h2 block-title">Current deliveries</h2>
          <Link to="/delivery/orders" className="see-all">
            All deliveries
          </Link>
        </div>
        {loading ? (
          <Skeleton rows={2} />
        ) : active.length === 0 ? (
          <EmptyState
            title="No deliveries right now"
            text={
              rider.is_online
                ? 'New orders will appear here when shops mark them ready.'
                : 'You are offline. Go online to receive orders.'
            }
          />
        ) : (
          <ul className="delivery-list">
            {active.map((o) => (
              <DeliveryCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Delivery Dashboard — /delivery
export default function DeliveryDashboard() {
  return (
    <RequireRider>
      <RequireApproval>
        <Dashboard />
      </RequireApproval>
    </RequireRider>
  )
}
