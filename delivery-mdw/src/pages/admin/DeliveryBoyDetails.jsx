import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { VEHICLES } from '../../context/RiderContext'
import { ActivePill, ConfirmButton, DataTable, StagePill } from '../../components/admin/ui'
import { DeliveryStatusBadge, EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'
import { ACTIVE_DELIVERY, OnlinePill } from './DeliveryBoys'

// Delivery boy details — /admin/delivery/:id
export default function DeliveryBoyDetails() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: '', rider: null, orders: [] })
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', rider: null, orders: [] })
    const [rider, orders] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, phone, is_active, created_at, delivery_riders(avatar_url, vehicle_type, vehicle_number, is_online, is_approved)')
        .eq('id', id)
        .eq('role', 'delivery')
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, shop_name, total, delivery_fee, status, delivery_status, delivery_boy_id, assigned_at, delivered_at')
        .eq('delivery_boy_id', id)
        .order('assigned_at', { ascending: false })
        .limit(50),
    ])
    const error = rider.error || orders.error
    setState({ loading: false, error: error ? error.message : '', rider: rider.data, orders: orders.data ?? [] })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function setApproved(approved) {
    setActionError('')
    const { error } = await supabase.rpc('admin_set_rider_approved', { p_rider_id: id, p_approved: approved })
    if (error) setActionError(error.message)
    await load()
  }

  async function setActive(active) {
    setActionError('')
    const { error } = await supabase.rpc('admin_set_user_active', { p_user_id: id, p_active: active })
    if (error) setActionError(error.message)
    await load()
  }

  const { loading, error, rider, orders } = state
  if (loading) return <div className="admin-page"><Skeleton rows={4} /></div>
  if (error && !rider) return <div className="admin-page"><ErrorState message={error} onRetry={load} /></div>
  if (!rider) {
    return (
      <div className="admin-page">
        <EmptyState title="Delivery boy not found" action={<Link to="/admin/delivery" className="btn btn-primary">Back to delivery boys</Link>} />
      </div>
    )
  }

  const d = rider.delivery_riders
  const active = orders.filter((o) => ACTIVE_DELIVERY.includes(o.delivery_status))
  const delivered = orders.filter((o) => o.delivery_status === 'delivered')
  const earned = delivered.reduce((s, o) => s + Number(o.delivery_fee), 0)

  return (
    <div className="admin-page">
      <PageHeader title={rider.name || rider.email} back={{ to: '/admin/delivery', label: 'Delivery Boys' }} />
      <div className="admin-grid">
        <section className="card">
          <div className="shop-profile-head">
            <ImageTile src={d?.avatar_url} name={rider.name || rider.email} className="shop-profile-img avatar-img" />
            <div className="row gap wrap">
              {d?.is_approved ? <OnlinePill online={Boolean(d?.is_online)} /> : <span className="pill pill-warn">Awaiting approval</span>}
              <ActivePill active={rider.is_active} />
            </div>
          </div>
          <dl className="details">
            <div><dt>Phone</dt><dd>{rider.phone || '—'}</dd></div>
            <div><dt>Email</dt><dd className="break">{rider.email}</dd></div>
            <div><dt>Vehicle</dt><dd>{[VEHICLES[d?.vehicle_type], d?.vehicle_number].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(rider.created_at)}</dd></div>
            <div><dt>Active deliveries</dt><dd>{active.length}</dd></div>
            <div><dt>Delivered</dt><dd>{delivered.length} (fees {formatPrice(earned)})</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="h3">Approval</h2>
          {d?.is_approved ? (
            <>
              <p className="muted">Approved: can go online, receive orders and see customer locations while delivering.</p>
              <ConfirmButton
                label="Revoke approval"
                danger
                confirmText="Revoke approval? He goes offline, deliveries he hasn't picked up yet are handed to someone else, and he can't see any orders until approved again."
                confirmLabel="Yes, revoke"
                onConfirm={() => setApproved(false)}
              />
            </>
          ) : (
            <>
              <p className="muted">
                Awaiting approval: he can't go online, be assigned orders or see any order or customer data. Check his name, phone and
                vehicle first.
              </p>
              <ConfirmButton
                label="Approve delivery boy"
                confirmText="Approve this delivery boy? He will be able to receive orders and see customer delivery locations for his deliveries."
                confirmLabel="Yes, approve"
                onConfirm={() => setApproved(true)}
              />
            </>
          )}
          <h2 className="h3 admin-actions-title">Account access</h2>
          {rider.is_active ? (
            <>
              <p className="muted">Deactivating takes them offline and hands unaccepted deliveries to someone else.</p>
              <ConfirmButton
                label="Deactivate delivery boy"
                danger
                confirmText={`Deactivate ${rider.name || rider.email}? They won't be able to log in to deliveries until activated again.`}
                confirmLabel="Yes, deactivate"
                onConfirm={() => setActive(false)}
              />
            </>
          ) : (
            <ConfirmButton label="Activate delivery boy" confirmText="Let this delivery boy work again?" confirmLabel="Yes, activate" onConfirm={() => setActive(true)} />
          )}
          {actionError && <ErrorState message={actionError} />}
        </section>

        <section className="card span-all">
          <h2 className="h3">Assigned deliveries ({orders.length})</h2>
          <DataTable
            rows={orders}
            rowKey={(o) => o.id}
            empty="No deliveries assigned yet."
            columns={[
              { label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.order_number)}</Link> },
              { label: 'Customer', render: (o) => o.customer_name || '—' },
              { label: 'Shop', render: (o) => o.shop_name },
              { label: 'Total', num: true, render: (o) => formatPrice(o.total) },
              { label: 'Assigned', render: (o) => formatDate(o.assigned_at, true) },
              { label: 'Delivery', render: (o) => <DeliveryStatusBadge status={o.delivery_status} /> },
              { label: 'Status', render: (o) => <StagePill order={o} /> },
            ]}
          />
        </section>
      </div>
    </div>
  )
}
