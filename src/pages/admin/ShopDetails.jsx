import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatOrderNumber, formatPrice, isUuid } from '../../lib/format'
import { ActivePill, ConfirmButton, DataTable, StagePill } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, OpenBadge, PageHeader, Skeleton } from '../../components/user/ui'
import { ShopState } from './Shops'

// Shop details — /admin/shops/:id
export default function AdminShopDetails() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: '', shop: null, orders: [], productCount: 0 })
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', shop: null, orders: [], productCount: 0 })
    const [shop, orders, products] = await Promise.all([
      supabase
        .from('shops')
        .select('*, owner:profiles!shops_owner_id_fkey(id, name, email, phone, is_active)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, total, status, delivery_status, delivery_boy_id, created_at')
        .eq('shop_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', id),
    ])
    const error = shop.error || orders.error || products.error
    setState({
      loading: false,
      error: error ? error.message : '',
      shop: shop.data,
      orders: orders.data ?? [],
      productCount: products.count ?? 0,
    })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function update(changes) {
    setActionError('')
    const { error } = await supabase.rpc('admin_update_shop', { p_shop_id: id, ...changes })
    if (error) setActionError(error.message)
    await load()
  }

  const { loading, error, shop, orders, productCount } = state
  if (loading) return <div className="admin-page"><Skeleton rows={4} /></div>
  if (error && !shop) return <div className="admin-page"><ErrorState message={error} onRetry={load} /></div>
  if (!shop) {
    return (
      <div className="admin-page">
        <EmptyState title="Shop not found" action={<Link to="/admin/shops" className="btn btn-primary">Back to shops</Link>} />
      </div>
    )
  }

  return (
    <div className="admin-page">
      <PageHeader title={shop.name} back={{ to: '/admin/shops', label: 'Shops' }} />
      <div className="admin-grid">
        <section className="card">
          <div className="shop-profile-head">
            <ImageTile src={shop.image_url} name={shop.name} className="shop-profile-img" />
            <div className="row gap wrap">
              <ShopState shop={shop} />
              <OpenBadge isOpen={shop.is_open} />
            </div>
          </div>
          <dl className="details">
            <div><dt>Address</dt><dd className="break">{shop.location || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{shop.phone || '—'}</dd></div>
            <div><dt>About</dt><dd className="break">{shop.description || '—'}</dd></div>
            <div><dt>Delivery fee</dt><dd>{Number(shop.delivery_fee) > 0 ? formatPrice(shop.delivery_fee) : 'Free'}</dd></div>
            <div>
              <dt>Products</dt>
              <dd>
                <Link to={`/admin/products?shop=${shop.id}`}>{productCount} {productCount === 1 ? 'product' : 'products'}</Link>
              </dd>
            </div>
            <div><dt>Created</dt><dd>{formatDate(shop.created_at)}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="h3">Owner</h2>
          <dl className="details">
            <div><dt>Name</dt><dd>{shop.owner ? <Link to={`/admin/users/${shop.owner.id}`}>{shop.owner.name || '—'}</Link> : '—'}</dd></div>
            <div><dt>Email</dt><dd className="break">{shop.owner?.email || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{shop.owner?.phone || '—'}</dd></div>
            <div><dt>Account</dt><dd>{shop.owner && <ActivePill active={shop.owner.is_active} />}</dd></div>
          </dl>

          <h2 className="h3 admin-actions-title">Actions</h2>
          <div className="admin-actions">
            {!shop.is_approved && (
              <ConfirmButton
                label="Approve shop"
                confirmText="Approve this shop? Customers will be able to see it and order from it."
                confirmLabel="Yes, approve"
                onConfirm={() => update({ p_is_approved: true })}
              />
            )}
            {shop.is_active ? (
              <ConfirmButton
                label="Disable shop"
                danger
                confirmText="Disable this shop? Customers won't see it and can't order from it. Existing orders are not affected."
                confirmLabel="Yes, disable"
                onConfirm={() => update({ p_is_active: false })}
              />
            ) : (
              <ConfirmButton
                label="Enable shop"
                confirmText="Enable this shop again?"
                confirmLabel="Yes, enable"
                onConfirm={() => update({ p_is_active: true })}
              />
            )}
          </div>
          {actionError && <ErrorState message={actionError} />}
        </section>

        <section className="card span-all">
          <h2 className="h3">Recent orders</h2>
          <DataTable
            rows={orders}
            rowKey={(o) => o.id}
            empty="No orders yet."
            columns={[
              { label: 'Order', render: (o) => <Link to={`/admin/orders/${o.id}`}>{formatOrderNumber(o.order_number)}</Link> },
              { label: 'Customer', render: (o) => o.customer_name || '—' },
              { label: 'Total', num: true, render: (o) => formatPrice(o.total) },
              { label: 'Date', render: (o) => formatDate(o.created_at, true) },
              { label: 'Status', render: (o) => <StagePill order={o} /> },
            ]}
          />
        </section>
      </div>
    </div>
  )
}
