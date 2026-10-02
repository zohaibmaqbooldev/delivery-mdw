import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { DeliveryStatusBadge, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'

const STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
]

function ShopProgress({ status }) {
  if (status === 'cancelled') return <p className="alert alert-error">This order was rejected.</p>
  const i = STEPS.findIndex((s) => s.key === status)
  const current = i === -1 ? STEPS.length : i // past "ready": all steps done
  return (
    <ol className="progress progress-4" aria-label="Order progress">
      {STEPS.map((s, idx) => (
        <li key={s.key} className={idx < current ? 'is-done' : idx === current ? 'is-current' : ''} aria-current={idx === current ? 'step' : undefined}>
          <span className="progress-dot" aria-hidden="true" />
          <span className="progress-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

function Actions({ order, onChange }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)

  async function setStatus(status) {
    setBusy(status)
    setError('')
    const { error: err } = await supabase.rpc('shop_update_order_status', { p_order_id: order.id, p_status: status })
    setBusy('')
    setConfirmReject(false)
    if (err) setError(err.message)
    onChange() // reload either way, so the page shows the real current status
  }

  const s = order.status
  let content = null

  if (s === 'pending' || s === 'accepted') {
    const primary =
      s === 'pending'
        ? { status: 'accepted', label: 'Accept order' }
        : { status: 'preparing', label: 'Mark as Preparing' }
    const rejectLabel = s === 'pending' ? 'Reject order' : 'Cancel order'
    content = confirmReject ? (
      <div className="confirm-box" role="group" aria-label="Confirm rejection">
        <p>
          {s === 'pending' ? 'Reject' : 'Cancel'} this order? The customer will see it as cancelled. This can't be undone.
        </p>
        <div className="row gap wrap">
          <button className="btn btn-danger" onClick={() => setStatus('cancelled')} disabled={Boolean(busy)}>
            {busy === 'cancelled' ? 'Saving…' : `Yes, ${rejectLabel.toLowerCase()}`}
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirmReject(false)} disabled={Boolean(busy)}>
            Keep order
          </button>
        </div>
      </div>
    ) : (
      <div className="row gap wrap">
        <button className="btn btn-primary" onClick={() => setStatus(primary.status)} disabled={Boolean(busy)}>
          {busy === primary.status ? 'Saving…' : primary.label}
        </button>
        <button className="btn btn-ghost danger-text" onClick={() => setConfirmReject(true)} disabled={Boolean(busy)}>
          {rejectLabel}
        </button>
      </div>
    )
  } else if (s === 'preparing') {
    content = (
      <button className="btn btn-primary" onClick={() => setStatus('ready')} disabled={Boolean(busy)}>
        {busy === 'ready' ? 'Saving…' : 'Mark as Ready'}
      </button>
    )
  } else if (s === 'ready') {
    content = <p className="muted">Ready for pickup. A delivery boy will be assigned to this order.</p>
  } else if (s === 'out_for_delivery') {
    content = <p className="muted">A delivery boy has picked up this order.</p>
  } else if (s === 'delivered') {
    content = <p className="muted">This order was delivered.</p>
  } else {
    content = <p className="muted">No further actions.</p>
  }

  return (
    <div className="order-actions">
      {content}
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
  const { shop } = useMyShop()
  const [state, setState] = useState({ loading: true, error: '', order: null })

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', order: null })
    setState((s) => ({ ...s, loading: true, error: '' }))
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, order_number, customer_name, status, delivery_status, contact_phone,
         notes, subtotal, delivery_fee, total, created_at, updated_at,
         order_items ( id, product_name, unit_price, quantity, line_total )`,
      )
      .eq('id', id)
      .eq('shop_id', shop.id)
      .maybeSingle()
    setState({ loading: false, error: error ? error.message : '', order: data })
  }, [id, shop.id])

  useEffect(() => {
    load()
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
          text="This order doesn't exist or was placed with another shop."
          action={
            <Link to="/shop/orders" className="btn btn-primary">
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
        back={{ to: '/shop/orders', label: 'All orders' }}
      >
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </PageHeader>

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
          <ShopProgress status={order.status} />
          <Actions order={order} onChange={load} />
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
          <h2 className="h3">Customer</h2>
          <dl className="details">
            <div>
              <dt>Name</dt>
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
                <dt>Note</dt>
                <dd className="break">{order.notes}</dd>
              </div>
            )}
          </dl>
          <p className="muted small privacy-note">
            The delivery address and location are shared only with the delivery boy, to protect the customer's privacy.
          </p>
        </section>
      </div>
    </div>
  )
}

// Shop Order Details — /shop/orders/:id
export default function ShopOrderDetails() {
  return (
    <RequireShop>
      <Details />
    </RequireShop>
  )
}
