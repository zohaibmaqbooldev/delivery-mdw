import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { roleLabel } from '../../lib/roles'
import { ActivePill, ConfirmButton, DataTable, StagePill } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'

// User details — /admin/users/:id
export default function UserDetails() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', user: null, orders: [], shop: null })
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', user: null, orders: [], shop: null })
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, is_active, avatar_url, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error || !user) return setState({ loading: false, error: error?.message ?? '', user: null, orders: [], shop: null })

    let orders = []
    let shop = null
    if (user.role === 'user') {
      const r = await supabase
        .from('orders')
        .select('id, order_number, shop_name, total, status, delivery_status, delivery_boy_id, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      orders = r.data ?? []
    } else if (user.role === 'shop') {
      const r = await supabase.from('shops').select('id, name, is_approved, is_active').eq('owner_id', id).maybeSingle()
      shop = r.data
    }
    setState({ loading: false, error: '', user, orders, shop })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function setActive(active) {
    setActionError('')
    const { error } = await supabase.rpc('admin_set_user_active', { p_user_id: id, p_active: active })
    if (error) setActionError(error.message)
    await load()
  }

  const { loading, error, user, orders, shop } = state
  if (loading) return <div className="admin-page"><Skeleton rows={4} /></div>
  if (error) return <div className="admin-page"><ErrorState message={error} onRetry={load} /></div>
  if (!user) {
    return (
      <div className="admin-page">
        <EmptyState title="Account not found" action={<Link to="/admin/users" className="btn btn-primary">Back to users</Link>} />
      </div>
    )
  }

  const isMe = user.id === me.id

  return (
    <div className="admin-page">
      <PageHeader title={user.name || user.email} back={{ to: '/admin/users', label: 'Users' }} />
      <div className="admin-grid">
        <section className="card">
          <div className="shop-profile-head">
            <ImageTile src={user.avatar_url} name={user.name || user.email} className="shop-profile-img avatar-img" />
            <div>
              <span className={`badge badge-${user.role}`}>{roleLabel(user.role)}</span> <ActivePill active={user.is_active} />
            </div>
          </div>
          <dl className="details">
            <div><dt>Name</dt><dd>{user.name || '—'}</dd></div>
            <div><dt>Email</dt><dd className="break">{user.email}</dd></div>
            <div><dt>Phone</dt><dd>{user.phone || '—'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(user.created_at)}</dd></div>
          </dl>
          {user.role === 'shop' && (
            <p className="admin-link-row">
              {shop ? <Link to={`/admin/shops/${shop.id}`}>View shop: {shop.name}</Link> : <span className="muted">Hasn't set up a shop yet.</span>}
            </p>
          )}
          {user.role === 'delivery' && (
            <p className="admin-link-row">
              <Link to={`/admin/delivery/${user.id}`}>View delivery profile and deliveries</Link>
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="h3">Account access</h2>
          {isMe ? (
            <p className="muted">This is your own account. You can't deactivate yourself.</p>
          ) : user.is_active ? (
            <>
              <p className="muted">
                Deactivating stops this account from using the app.
                {user.role === 'shop' && ' Their shop is closed so it gets no new orders.'}
                {user.role === 'delivery' && ' They go offline and unaccepted deliveries are handed to someone else.'}
              </p>
              <ConfirmButton
                label="Deactivate account"
                danger
                confirmText={`Deactivate ${user.name || user.email}? They won't be able to use Delivery MDW until you activate them again.`}
                confirmLabel="Yes, deactivate"
                onConfirm={() => setActive(false)}
              />
            </>
          ) : (
            <>
              <p className="muted">This account is deactivated.</p>
              <ConfirmButton label="Activate account" confirmText="Let this account use Delivery MDW again?" confirmLabel="Yes, activate" onConfirm={() => setActive(true)} />
            </>
          )}
          {actionError && <ErrorState message={actionError} />}
        </section>

        {user.role === 'user' && (
          <section className="card span-all">
            <h2 className="h3">Orders ({orders.length})</h2>
            <DataTable
              rows={orders}
              rowKey={(o) => o.id}
              empty="No orders yet."
              columns={[
                { label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.order_number)}</Link> },
                { label: 'Shop', render: (o) => o.shop_name },
                { label: 'Total', num: true, render: (o) => formatPrice(o.total) },
                { label: 'Date', render: (o) => formatDate(o.created_at, true) },
                { label: 'Status', render: (o) => <StagePill order={o} /> },
              ]}
            />
          </section>
        )}
      </div>
    </div>
  )
}
