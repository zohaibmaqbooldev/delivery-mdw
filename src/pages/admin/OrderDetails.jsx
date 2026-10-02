import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { FLOW, canAssign, orderStage } from '../../lib/orderFlow'
import { VEHICLES } from '../../context/RiderContext'
import { StagePill } from '../../components/admin/ui'
import { DeliveryStatusBadge, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'
import { activeDeliveryCounts } from './DeliveryBoys'
import DeliveryLocation, { LOCATION_FIELDS } from '../../components/map/DeliveryLocation'

function Flow({ order }) {
  const stage = orderStage(order)
  if (stage.key === 'cancelled') return <p className="alert alert-error">This order was cancelled.</p>
  const current = FLOW.findIndex((s) => s.key === stage.key)
  return (
    <ol className="progress progress-7" aria-label="Order flow">
      {FLOW.map((s, i) => (
        <li key={s.key} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="progress-dot" aria-hidden="true" />
          <span className="progress-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

function AssignPanel({ order, onAssigned }) {
  const [riders, setRiders] = useState(null)
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      supabase
        .from('profiles')
        .select('id, name, phone, delivery_riders!inner(is_online, vehicle_type, is_approved)')
        .eq('role', 'delivery')
        .eq('is_active', true)
        .eq('delivery_riders.is_approved', true)
        .order('name'),
      activeDeliveryCounts(),
    ]).then(([{ data }, counts]) => {
      if (!active) return
      const list = (data ?? []).map((r) => ({ ...r, online: Boolean(r.delivery_riders?.is_online), active: counts[r.id] ?? 0 }))
      list.sort((a, b) => Number(b.online) - Number(a.online) || a.active - b.active)
      setRiders(list)
    })
    return () => {
      active = false
    }
  }, [order.id])

  async function assign(e) {
    e.preventDefault()
    if (!choice) return setError('Choose a delivery boy.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('admin_assign_delivery', { p_order_id: order.id, p_rider_id: choice })
    setBusy(false)
    if (err) return setError(err.message)
    const r = riders.find((x) => x.id === choice)
    setDone(`Assigned to ${r?.name ?? 'delivery boy'}.`)
    setChoice('')
    onAssigned()
  }

  if (!riders) return <Skeleton rows={1} />
  const others = riders.filter((r) => r.id !== order.delivery_boy_id)

  return (
    <form className="assign-form" onSubmit={assign}>
      <label className="field">
        <span>{order.delivery_boy_id ? 'Re-assign to another delivery boy' : 'Assign a delivery boy'}</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Delivery boy">
          <option value="">Choose…</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || r.phone} — {r.online ? 'online' : 'offline'}, {r.active} active
            </option>
          ))}
        </select>
      </label>
      {others.length === 0 && <p className="muted small">No other active, approved delivery boys.</p>}
      <p className="muted small">Offline delivery boys see the order the next time they open the app.</p>
      {error && <div className="alert alert-error" role="alert">{friendlyError(error)}</div>}
      {done && <div className="alert alert-success" role="status">{done}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy || others.length === 0}>
        {busy ? 'Assigning…' : 'Assign delivery boy'}
      </button>
    </form>
  )
}

// Order details — /admin/orders/:id
export default function AdminOrderDetails() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: '', order: null })

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', order: null })
    const { data, error } = await supabase
      .from('orders')
      .select(
        `*, order_items ( id, product_name, unit_price, quantity, line_total ),
         location:order_locations ( ${LOCATION_FIELDS} ),
         shop:shops ( id, name, location, phone ),
         customer:profiles!orders_user_id_fkey ( id, email, phone ),
         rider:profiles!orders_delivery_boy_id_fkey ( id, name, phone, delivery_riders ( vehicle_type, vehicle_number, is_online ) )`,
      )
      .eq('id', id)
      .maybeSingle()
    setState({ loading: false, error: error ? error.message : '', order: data })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const { loading, error, order } = state
  if (loading && !order) return <div className="admin-page"><Skeleton rows={5} /></div>
  if (error && !order) return <div className="admin-page"><ErrorState message={error} onRetry={load} /></div>
  if (!order) {
    return (
      <div className="admin-page">
        <EmptyState title="Order not found" action={<Link to="/admin/orders" className="btn btn-primary">Back to orders</Link>} />
      </div>
    )
  }

  const rider = order.rider
  const rv = rider?.delivery_riders

  return (
    <div className="admin-page">
      <PageHeader title={`Order ${formatOrderNumber(order.order_number)}`} subtitle={`Placed ${formatDate(order.created_at, true)}`} back={{ to: '/admin/orders', label: 'Orders' }}>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          Refresh
        </button>
      </PageHeader>

      <div className="admin-grid">
        <section className="card span-all">
          <div className="status-row">
            <div><span className="muted small">Stage</span><StagePill order={order} /></div>
            <div><span className="muted small">Order status</span><OrderStatusBadge status={order.status} /></div>
            <div><span className="muted small">Delivery status</span><DeliveryStatusBadge status={order.delivery_status} /></div>
          </div>
          <Flow order={order} />
        </section>

        <section className="card">
          <h2 className="h3">Customer</h2>
          <dl className="details">
            <div><dt>Name</dt><dd>{order.customer ? <Link to={`/admin/users/${order.customer.id}`}>{order.customer_name || '—'}</Link> : order.customer_name || '—'}</dd></div>
            <div><dt>Email</dt><dd className="break">{order.customer?.email || '—'}</dd></div>
            <div><dt>Contact phone</dt><dd>{order.contact_phone}</dd></div>
            {order.notes && <div><dt>Note for shop</dt><dd className="break">{order.notes}</dd></div>}
          </dl>
          <h3 className="h3 sub-title">Delivery location</h3>
          {order.location ? <DeliveryLocation location={order.location} mapLabel="Customer delivery location" /> : <p className="muted">No location on record.</p>}
        </section>

        <section className="card">
          <h2 className="h3">Shop</h2>
          <dl className="details">
            <div><dt>Name</dt><dd>{order.shop ? <Link to={`/admin/shops/${order.shop.id}`}>{order.shop.name}</Link> : order.shop_name}</dd></div>
            <div><dt>Address</dt><dd className="break">{order.shop?.location || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{order.shop?.phone || '—'}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="h3">Delivery Boy</h2>
          {rider ? (
            <dl className="details">
              <div><dt>Name</dt><dd><Link to={`/admin/delivery/${rider.id}`}>{rider.name || '—'}</Link></dd></div>
              <div><dt>Phone</dt><dd>{rider.phone || '—'}</dd></div>
              <div><dt>Vehicle</dt><dd>{[VEHICLES[rv?.vehicle_type], rv?.vehicle_number].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt>Assigned</dt><dd>{formatDate(order.assigned_at, true)}</dd></div>
              {order.delivered_at && <div><dt>Delivered</dt><dd>{formatDate(order.delivered_at, true)}</dd></div>}
            </dl>
          ) : (
            <p className="muted">
              {order.status === 'ready' ? 'Not assigned yet.' : order.status === 'cancelled' ? 'No delivery — order cancelled.' : 'Can be assigned once the shop marks the order Ready.'}
            </p>
          )}
          {canAssign(order) && <AssignPanel order={order} onAssigned={load} />}
        </section>

        <section className="card">
          <h2 className="h3">Products</h2>
          <table className="items-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" className="num">Qty</th>
                <th scope="col" className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((it) => (
                <tr key={it.id}>
                  <td>{it.product_name}<span className="muted small d-block">{formatPrice(it.unit_price)} each</span></td>
                  <td className="num">× {it.quantity}</td>
                  <td className="num">{formatPrice(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
            <div><dt>Delivery fee</dt><dd>{Number(order.delivery_fee) > 0 ? formatPrice(order.delivery_fee) : 'Free'}</dd></div>
            <div className="totals-grand"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}
