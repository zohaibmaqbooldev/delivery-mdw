import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ORDER_STATUS, formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import {
  DeliveryStatusBadge,
  EmptyState,
  ErrorState,
  OrderStatusBadge,
  PageHeader,
  Skeleton,
} from '../../components/user/ui'
import DeliveryLocation, { LOCATION_FIELDS } from '../../components/map/DeliveryLocation'

const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']

function Progress({ status }) {
  if (status === 'cancelled') {
    return <p className="alert alert-error">This order was cancelled.</p>
  }
  const current = STEPS.indexOf(status)
  return (
    <ol className="progress" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="progress-dot" aria-hidden="true" />
          <span className="progress-label">{ORDER_STATUS[s].label}</span>
        </li>
      ))}
    </ol>
  )
}

// Order Details — /user/orders/:id
export default function OrderDetails() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [justPlaced] = useState(Boolean(location.state?.justPlaced))

  // Show "order placed" once; don't bring it back when the page is reloaded later.
  useEffect(() => {
    if (location.state?.justPlaced) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  const [state, setState] = useState({ loading: true, error: '', order: null })

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', order: null })
    setState((s) => ({ ...s, loading: true, error: '' }))
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, order_number, shop_id, shop_name, status, delivery_status, contact_phone,
         notes, subtotal, delivery_fee, total, created_at,
         shops ( location, phone ),
         location:order_locations ( ${LOCATION_FIELDS} ),
         order_items ( id, product_name, unit_price, quantity, line_total )`,
      )
      .eq('id', id)
      .maybeSingle()
    setState({ loading: false, error: error ? error.message : '', order: data })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Status changes are made by the shop and rider, so refresh when the tab regains focus.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [load])

  const { loading, error, order } = state

  if (loading && !order) {
    return (
      <div className="container user-content">
        <Skeleton rows={4} />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="container user-content">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container user-content">
        <EmptyState
          title="Order not found"
          text="This order doesn't exist or belongs to another account."
          action={
            <Link to="/user/orders" className="btn btn-primary">
              Back to orders
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="container user-content">
      <PageHeader
        title={`Order ${formatOrderNumber(order.order_number)}`}
        subtitle={`Placed ${formatDate(order.created_at, true)}`}
        back={{ to: '/user/orders', label: 'All orders' }}
      >
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </PageHeader>

      {justPlaced && order.status === 'pending' && (
        <div className="alert alert-success" role="status">
          Your order has been placed. {order.shop_name} will confirm it shortly.
        </div>
      )}

      <div className="order-layout">
        <section className="card">
          <div className="status-row">
            <div>
              <span className="muted small">Order status</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <div>
              <span className="muted small">Delivery status</span>
              <DeliveryStatusBadge status={order.delivery_status} />
            </div>
          </div>
          <Progress status={order.status} />
        </section>

        <section className="card">
          <h2 className="h3">Products</h2>
          <table className="items-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" className="num">
                  Qty
                </th>
                <th scope="col" className="num">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.product_name}
                    <span className="muted small d-block">{formatPrice(it.unit_price)} each</span>
                  </td>
                  <td className="num">× {it.quantity}</td>
                  <td className="num">{formatPrice(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery fee</dt>
              <dd>{Number(order.delivery_fee) > 0 ? formatPrice(order.delivery_fee) : 'Free'}</dd>
            </div>
            <div className="totals-grand">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
          <p className="muted small">Payment: cash on delivery.</p>
        </section>

        <section className="card">
          <h2 className="h3">Shop</h2>
          <p className="strong">{order.shop_name}</p>
          {order.shops?.location && <p className="muted">{order.shops.location}</p>}
          {order.shops?.phone && (
            <p>
              <a href={`tel:${order.shops.phone}`}>{order.shops.phone}</a>
            </p>
          )}
          <Link to={`/user/shops/${order.shop_id}`} className="btn btn-outline btn-sm">
            View shop
          </Link>
        </section>

        <section className="card">
          <h2 className="h3">Delivery</h2>
          <dl className="details">
            <div>
              <dt>Phone</dt>
              <dd>{order.contact_phone}</dd>
            </div>
            {order.notes && (
              <div>
                <dt>Note for shop</dt>
                <dd className="break">{order.notes}</dd>
              </div>
            )}
          </dl>
          <DeliveryLocation location={order.location} mapLabel="Your delivery location" />
          <p className="muted small privacy-note">Only your delivery boy and our admins can see your location.</p>
        </section>
      </div>
    </div>
  )
}
