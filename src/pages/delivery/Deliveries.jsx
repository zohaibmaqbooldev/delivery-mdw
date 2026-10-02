import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { RequireApproval, RequireRider } from '../../components/delivery/DeliveryLayout'
import DeliveryCard, { DELIVERY_LIST_FIELDS } from '../../components/delivery/DeliveryCard'
import usePolling from '../../lib/usePolling'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/user/ui'

const FILTERS = [
  { key: 'active', label: 'Active', statuses: ['assigned', 'accepted', 'picked_up', 'out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'all', label: 'All', statuses: null },
]

function List() {
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.key === params.get('show')) ?? FILTERS[0]
  const [state, setState] = useState({ loading: true, error: '', orders: [] })

  // RLS returns only orders assigned to the signed-in delivery boy.
  const load = useCallback(async () => {
    let q = supabase.from('orders').select(DELIVERY_LIST_FIELDS)
    if (filter.statuses) q = q.in('delivery_status', filter.statuses)
    q =
      filter.key === 'active'
        ? q.order('assigned_at', { ascending: true })
        : q.order('delivered_at', { ascending: false, nullsFirst: true }).order('assigned_at', { ascending: false })
    const { data, error } = await q
    setState({ loading: false, error: error ? error.message : '', orders: data ?? [] })
  }, [filter])

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }))
    load()
  }, [load])

  usePolling(load, 30000)

  const { loading, error, orders } = state

  return (
    <div className="container user-content">
      <PageHeader title="My Deliveries" subtitle="Orders assigned to you.">
        <button className="btn btn-ghost btn-sm" onClick={load}>
          Refresh
        </button>
      </PageHeader>

      <div className="chips" role="group" aria-label="Filter deliveries">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${f.key === filter.key ? 'is-active' : ''}`}
            aria-pressed={f.key === filter.key}
            onClick={() => setParams(f.key === 'active' ? {} : { show: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <Skeleton rows={3} />
      ) : orders.length === 0 ? (
        <EmptyState
          title={filter.key === 'delivered' ? 'No completed deliveries yet' : 'No deliveries'}
          text={filter.key === 'active' ? 'Orders assigned to you will appear here.' : undefined}
        />
      ) : (
        <ul className="delivery-list">
          {orders.map((o) => (
            <DeliveryCard key={o.id} order={o} />
          ))}
        </ul>
      )}
    </div>
  )
}

// My Deliveries — /delivery/orders
export default function Deliveries() {
  return (
    <RequireRider>
      <RequireApproval>
        <List />
      </RequireApproval>
    </RequireRider>
  )
}
