import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch, formatDate, formatOrderNumber, formatPrice } from '../../lib/format'
import { STAGE_FILTERS } from '../../lib/orderFlow'
import { DataTable, FilterChips, SearchBox, StagePill } from '../../components/admin/ui'
import { ErrorState, PageHeader, Skeleton } from '../../components/user/ui'

const LIMIT = 200
export const ORDER_LIST_FIELDS =
  'id, order_number, customer_name, shop_name, total, status, delivery_status, delivery_boy_id, created_at, rider:profiles!orders_delivery_boy_id_fkey(name)'

// Orders — /admin/orders
export default function Orders() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const stageKey = params.get('stage') ?? 'all'
  const stage = STAGE_FILTERS.find((s) => s.key === stageKey) ?? STAGE_FILTERS[0]
  const [state, setState] = useState({ loading: true, error: '', orders: [] })

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params)
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    let query = supabase.from('orders').select(ORDER_LIST_FIELDS).order('created_at', { ascending: false }).limit(LIMIT)
    const raw = q.trim().replace(/^#/, '')
    if (/^\d+$/.test(raw)) query = query.eq('order_number', Number(raw))
    else {
      const term = cleanSearch(q)
      if (term) query = query.or(`customer_name.ilike.%${term}%,shop_name.ilike.%${term}%`)
    }
    query = stage.apply(query)
    const { data, error } = await query
    setState({ loading: false, error: error ? error.message : '', orders: data ?? [] })
  }, [q, stage])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = useCallback((t) => setParam('q', t), [setParam])
  const { loading, error, orders } = state

  return (
    <div className="admin-page">
      <PageHeader title="Orders" subtitle="Every order: Pending → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered.">
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </PageHeader>
      <SearchBox value={q} onSearch={onSearch} placeholder="Search order #, customer or shop" />
      <FilterChips label="Filter by status" options={STAGE_FILTERS} value={stage.key} onChange={(k) => setParam('stage', k)} />
      {error && <ErrorState message={error} onRetry={load} />}
      <section className="card">
        {loading ? (
          <Skeleton rows={5} />
        ) : (
          <>
            <p className="muted small">
              {orders.length === LIMIT ? `Showing the latest ${LIMIT} orders. Use search to narrow down.` : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
            </p>
            <DataTable
              rows={orders}
              rowKey={(o) => o.id}
              empty="No orders match."
              columns={[
                { label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.order_number)}</Link> },
                { label: 'Customer', render: (o) => o.customer_name || '—' },
                { label: 'Shop', render: (o) => o.shop_name },
                { label: 'Delivery Boy', render: (o) => o.rider?.name || <span className="muted">—</span> },
                { label: 'Total', num: true, render: (o) => formatPrice(o.total) },
                { label: 'Date', render: (o) => formatDate(o.created_at, true) },
                { label: 'Status', render: (o) => <StagePill order={o} /> },
              ]}
            />
          </>
        )}
      </section>
    </div>
  )
}
