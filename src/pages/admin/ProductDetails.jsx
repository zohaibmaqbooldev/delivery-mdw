import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDate, formatPrice, isUuid } from '../../lib/format'
import { ConfirmButton } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'
import { ProductState } from './Products'

// Product details — /admin/products/:id
export default function AdminProductDetails() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: '', product: null, sold: 0 })
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', product: null, sold: 0 })
    const [p, items] = await Promise.all([
      supabase.from('products').select('*, shop:shops(id, name), categories(name)').eq('id', id).maybeSingle(),
      supabase.from('order_items').select('quantity').eq('product_id', id),
    ])
    const error = p.error || items.error
    const sold = (items.data ?? []).reduce((n, r) => n + r.quantity, 0)
    setState({ loading: false, error: error ? error.message : '', product: p.data, sold })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function setDisabled(disabled) {
    setActionError('')
    const { error } = await supabase.rpc('admin_set_product_disabled', { p_product_id: id, p_disabled: disabled })
    if (error) setActionError(error.message)
    await load()
  }

  const { loading, error, product, sold } = state
  if (loading) return <div className="admin-page"><Skeleton rows={3} /></div>
  if (error && !product) return <div className="admin-page"><ErrorState message={error} onRetry={load} /></div>
  if (!product) {
    return (
      <div className="admin-page">
        <EmptyState title="Product not found" action={<Link to="/admin/products" className="btn btn-primary">Back to products</Link>} />
      </div>
    )
  }

  return (
    <div className="admin-page">
      <PageHeader title={product.name} back={{ to: '/admin/products', label: 'Products' }} />
      <div className="admin-grid">
        <section className="card">
          <div className="shop-profile-head">
            <ImageTile src={product.image_url} name={product.name} className="shop-profile-img" />
            <ProductState product={product} />
          </div>
          <dl className="details">
            <div><dt>Shop</dt><dd>{product.shop ? <Link to={`/admin/shops/${product.shop.id}`}>{product.shop.name}</Link> : '—'}</dd></div>
            <div><dt>Price</dt><dd>{formatPrice(product.price)}</dd></div>
            <div><dt>Category</dt><dd>{product.categories?.name ?? '—'}</dd></div>
            <div><dt>Description</dt><dd className="break">{product.description || '—'}</dd></div>
            <div><dt>Shop availability</dt><dd>{product.is_available ? 'Available' : 'Marked unavailable by the shop'}</dd></div>
            <div><dt>Units ordered</dt><dd>{sold}</dd></div>
            <div><dt>Added</dt><dd>{formatDate(product.created_at)}</dd></div>
          </dl>
        </section>
        <section className="card">
          <h2 className="h3">Admin control</h2>
          {product.is_disabled ? (
            <>
              <p className="muted">Disabled: customers can't see or order it, and the shop can't turn it back on.</p>
              <ConfirmButton label="Enable product" confirmText="Enable this product again? The shop's own availability setting applies." confirmLabel="Yes, enable" onConfirm={() => setDisabled(false)} />
            </>
          ) : (
            <>
              <p className="muted">Disable a product that shouldn't be sold. Past orders are not affected.</p>
              <ConfirmButton label="Disable product" danger confirmText="Disable this product? Customers won't see it and it can't be ordered." confirmLabel="Yes, disable" onConfirm={() => setDisabled(true)} />
            </>
          )}
          {actionError && <ErrorState message={actionError} />}
        </section>
      </div>
    </div>
  )
}
