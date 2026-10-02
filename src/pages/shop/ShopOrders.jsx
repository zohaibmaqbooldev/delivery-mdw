import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import { formatDate, formatOrderNumber, formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton } from '../../components/user/ui'

export const ORDER_FILTERS = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'new', label: 'New', statuses: ['pending'] },
  { key: 'active', label: 'In progress', statuses: ['accepted', 'preparing'] },
  { key: 'ready', label: 'Ready', statuses: ['ready'] },
  { key: 'done', label: 'Completed', statuses: ['out_for_delivery', 'delivered'] },
  { key: 'cancelled', label: 'Rejected', statuses: ['cancelled'] },
]

function itemsSummary(items) {
  const text = items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')
  return text.length > 90 ? text.slice(0, 87) + '…' : text
}

function OrderList() {
  const { shop } = useMyShop()
  const [params, setParams] = useSearchParams()
  const filter = ORDER_FILTERS.find((f) => f.key === params.get('status')) ?? ORDER_FILTERS[0]
  const [state, setState] = useState({ loading: true, error: '', orders: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    let q = supabase
      .from('orders')
      .select('id, order_number, customer_name, total, status, created_at, order_items(product_name, quantity)')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    if (filter.statuses) q = q.in('status', filter.statuses)
    const { data, error } = await q
    setState({ loading: false, error: error ? error.message : '', orders: data ?? [] })
  }, [shop.id, filter])

  useEffect(() => {
    load()
  }, [load])

  // New orders arrive while the page is open: refresh when the tab regains focus.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const { loading, error, orders } = state

  return (
    <div className="container user-content">
      <PageHeader title="Orders" subtitle={`Orders placed with ${shop.name}.`}>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </PageHeader>

      <div className="chips" role="group" aria-label="Filter orders">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${f.key === filter.key ? 'is-active' : ''}`}
            aria-pressed={f.key === filter.key}
            onClick={() => setParams(f.key === 'all' ? {} : { status: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <Skeleton rows={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          title={filter.key === 'all' ? 'No orders yet' : `No ${filter.label.toLowerCase()} orders`}
          text={filter.key === 'all' ? 'Orders from customers will appear here.' : undefined}
        />
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id} className="card order-card shop-order-card">
              <div className="order-card-main">
                <div className="order-card-top">
                  <span className="order-number">Order {formatOrderNumber(o.order_number)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
                <span className="order-shop">{o.customer_name || 'Customer'}</span>
                <span className="order-items-summary">{itemsSummary(o.order_items)}</span>
                <span className="muted small">{formatDate(o.created_at, true)}</span>
              </div>
              <div className="order-card-side">
                <span className="order-total">{formatPrice(o.total)}</span>
                <Link to={`/shop/orders/${o.id}`} className="btn btn-outline btn-sm">
                  View Order
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Shop Orders — /shop/orders
export default function ShopOrders() {
  return (
    <RequireShop>
      <OrderList />
    </RequireShop>
  )
}
