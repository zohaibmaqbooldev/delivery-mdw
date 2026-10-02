import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { RequireApproval, RequireRider } from '../../components/delivery/DeliveryLayout'
import usePolling from '../../lib/usePolling'
import { mapSearchUrl } from '../../lib/geo'
import DeliveryLocation, { LOCATION_FIELDS } from '../../components/map/DeliveryLocation'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { DeliveryStatusBadge, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'

// Assigned → Accepted → Picked Up → Out for Delivery → Delivered
const STEPS = [
  { status: 'accepted', label: 'Accept Delivery', from: 'assigned' },
  { status: 'picked_up', label: 'Picked Up', from: 'accepted' },
  { status: 'out_for_delivery', label: 'Out for Delivery', from: 'picked_up' },
  { status: 'delivered', label: 'Delivered', from: 'out_for_delivery' },
]
const ORDER = ['assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered']


function StepButtons({ order, onChanged }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmDelivered, setConfirmDelivered] = useState(false)
  const current = ORDER.indexOf(order.delivery_status)

  async function advance(status) {
    setBusy(status)
    setError('')
    const { error: err } = await supabase.rpc('delivery_update_status', { p_order_id: order.id, p_status: status })
    setBusy('')
    setConfirmDelivered(false)
    if (err) setError(err.message)
    onChanged()
  }

  const waitingForShop = order.delivery_status === 'accepted' && order.status !== 'ready'

  return (
    <div className="delivery-steps">
      <ol className="step-buttons">
        {STEPS.map((s) => {
          const done = ORDER.indexOf(s.status) <= current
          const next = s.from === order.delivery_status
          const disabled = !next || Boolean(busy) || (s.status === 'picked_up' && waitingForShop)
          return (
            <li key={s.status}>
              <button
                type="button"
                className={`btn step-btn ${done ? 'is-done' : next ? 'btn-primary' : 'btn-ghost'}`}
                disabled={disabled}
                aria-current={next ? 'step' : undefined}
                onClick={() => (s.status === 'delivered' ? setConfirmDelivered(true) : advance(s.status))}
              >
                {done && <span aria-hidden="true">✓ </span>}
                {busy === s.status ? 'Saving…' : s.label}
              </button>
            </li>
          )
        })}
      </ol>

      {waitingForShop && <p className="muted small">Waiting for the shop to mark this order as ready.</p>}

      {confirmDelivered && (
        <div className="confirm-box confirm-ok" role="group" aria-label="Confirm delivery">
          <p>
            Collect <strong>{formatPrice(order.total)}</strong> in cash from the customer, then confirm.
          </p>
          <div className="row gap wrap">
            <button className="btn btn-primary" onClick={() => advance('delivered')} disabled={Boolean(busy)}>
              {busy === 'delivered' ? 'Saving…' : 'Confirm delivered'}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelivered(false)} disabled={Boolean(busy)}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {order.delivery_status === 'delivered' && (
        <div className="alert alert-success" role="status">
          Delivered {formatDate(order.delivered_at, true)}.
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
    </div>
  )
}

function Details() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: '', order: null })

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', order: null })
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, order_number, status, delivery_status, customer_name, contact_phone, notes,
         shop_name, subtotal, delivery_fee, total, created_at, assigned_at, delivered_at,
         shops ( name, location, phone ),
         location:order_locations ( ${LOCATION_FIELDS} ),
         order_items ( id, product_name, quantity, line_total )`,
      )
      .eq('id', id)
      .maybeSingle()
    setState({ loading: false, error: error ? error.message : '', order: data })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  usePolling(load, 30000)

  const { loading, error, order } = state

  if (loading) {
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
          title="Delivery not found"
          text="This order isn't assigned to you."
          action={
            <Link to="/delivery/orders" className="btn btn-primary">
              My deliveries
            </Link>
          }
        />
      </div>
    )
  }

  const shop = order.shops

  return (
    <div className="container user-content">
      <PageHeader
        title={`Order ${formatOrderNumber(order.order_number)}`}
        subtitle={order.assigned_at ? `Assigned ${formatDate(order.assigned_at, true)}` : undefined}
        back={{ to: '/delivery/orders', label: 'My deliveries' }}
      >
        <button className="btn btn-ghost btn-sm" onClick={load}>
          Refresh
        </button>
      </PageHeader>

      <div className="order-layout">
        <section className="card">
          <div className="status-row">
            <div>
              <span className="muted small">Delivery status</span>
              <DeliveryStatusBadge status={order.delivery_status} />
            </div>
            <div>
              <span className="muted small">Order status</span>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          <StepButtons order={order} onChanged={load} />
        </section>

        <section className="card">
          <h2 className="h3">1. Pick up from shop</h2>
          <dl className="details">
            <div>
              <dt>Shop</dt>
              <dd>{shop?.name ?? order.shop_name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd className="break">
                {shop?.location ? (
                  <a href={mapSearchUrl(shop.location)} target="_blank" rel="noopener noreferrer">
                    {shop.location}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{shop?.phone ? <a href={`tel:${shop.phone}`}>{shop.phone}</a> : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="h3">2. Deliver to customer</h2>
          <dl className="details">
            <div>
              <dt>Customer</dt>
              <dd>{order.customer_name || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${order.contact_phone}`}>{order.contact_phone}</a>
              </dd>
            </div>
            {order.notes && (
              <div>
                <dt>Note for shop</dt>
                <dd className="break">{order.notes}</dd>
              </div>
            )}
          </dl>
          {order.location ? (
            <DeliveryLocation location={order.location} navigate mapLabel="Customer delivery location" />
          ) : (
            <p className="muted small privacy-note">
              The customer's address and location are hidden once the delivery is completed.
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="h3">Ordered products</h2>
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
                  <td>{it.product_name}</td>
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
              <dt>Order total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
          <p className="muted small">Cash on delivery — collect {formatPrice(order.total)}.</p>
        </section>
      </div>
    </div>
  )
}

// Delivery Details — /delivery/orders/:id
export default function DeliveryDetails() {
  return (
    <RequireRider>
      <RequireApproval>
        <Details />
      </RequireApproval>
    </RequireRider>
  )
}
