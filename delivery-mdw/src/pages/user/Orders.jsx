import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatOrderNumber, formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton } from '../../components/user/ui'

// Orders — /user/orders  (RLS returns only the signed-in customer's orders)
export default function Orders() {
  const [state, setState] = useState({ loading: true, error: '', orders: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, shop_name, total, status, created_at')
      .order('created_at', { ascending: false })
    setState({ loading: false, error: error ? error.message : '', orders: data ?? [] })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { loading, error, orders } = state

  return (
    <div className="container user-content">
      <PageHeader title="Orders" subtitle="Your order history.">
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </PageHeader>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <Skeleton rows={3} />
      ) : orders.length === 0 && !error ? (
        <EmptyState
          title="No orders yet"
          text="When you place an order it will show up here."
          action={
            <Link to="/user/shops" className="btn btn-primary">
              Browse shops
            </Link>
          }
        />
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id} className="card order-card">
              <div className="order-card-main">
                <div className="order-card-top">
                  <span className="order-number">Order {formatOrderNumber(o.order_number)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
                <span className="order-shop">{o.shop_name}</span>
                <span className="muted small">{formatDate(o.created_at, true)}</span>
              </div>
              <div className="order-card-side">
                <span className="order-total">{formatPrice(o.total)}</span>
                <Link to={`/user/orders/${o.id}`} className="btn btn-outline btn-sm">
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
