import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import { removeImage } from '../../lib/images'
import { formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'

function ProductList() {
  const { shop } = useMyShop()
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(location.state?.notice ?? '')

  // Show the "saved" message once; don't bring it back on reload.
  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  const [state, setState] = useState({ loading: true, error: '', products: [] })
  const [confirmId, setConfirmId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, image_url, is_available, is_disabled, categories(name)')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    setState({ loading: false, error: error ? error.message : '', products: data ?? [] })
  }, [shop.id])

  useEffect(() => {
    load()
  }, [load])

  async function remove(p) {
    setDeletingId(p.id)
    setDeleteError('')
    const { data, error } = await supabase.from('products').delete().eq('id', p.id).eq('shop_id', shop.id).select('id')
    setDeletingId(null)
    setConfirmId(null)
    if (error || !data?.length) return setDeleteError(error ? error.message : 'This product could not be deleted.')
    await removeImage(p.image_url)
    setNotice(`“${p.name}” was deleted.`)
    setState((s) => ({ ...s, products: s.products.filter((x) => x.id !== p.id) }))
  }

  const { loading, error, products } = state

  return (
    <div className="container user-content">
      <PageHeader title="Products" subtitle={`${products.length} ${products.length === 1 ? 'product' : 'products'} in ${shop.name}`}>
        <Link to="/shop/products/add" className="btn btn-primary btn-sm">
          + Add product
        </Link>
      </PageHeader>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={load} />}
      {deleteError && <ErrorState message={deleteError} />}

      {loading ? (
        <Skeleton rows={4} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          text="Add your first product so customers can order from you."
          action={
            <Link to="/shop/products/add" className="btn btn-primary">
              Add product
            </Link>
          }
        />
      ) : (
        <ul className="product-list manage-list">
          {products.map((p) => (
            <li key={p.id} className="card product-row">
              <ImageTile src={p.image_url} name={p.name} className="product-row-img" />
              <div className="product-row-info">
                <span className="product-row-name">{p.name}</span>
                <span className="price">{formatPrice(p.price)}</span>
                <span className="row gap wrap">
                  <span className={`pill ${p.is_available ? 'pill-success' : 'pill-neutral'}`}>
                    {p.is_available ? 'Available' : 'Unavailable'}
                  </span>
                  {p.is_disabled && <span className="pill pill-danger">Disabled by admin</span>}
                  {p.categories?.name && <span className="muted small">{p.categories.name}</span>}
                </span>
              </div>
              <div className="product-row-action manage-actions">
                {confirmId === p.id ? (
                  <div className="confirm" role="group" aria-label={`Confirm delete ${p.name}`}>
                    <span className="small">Delete this product?</span>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)} disabled={deletingId === p.id}>
                      {deletingId === p.id ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <Link to={`/shop/products/${p.id}/edit`} className="btn btn-outline btn-sm" aria-label={`Edit ${p.name}`}>
                      Edit
                    </Link>
                    <button className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirmId(p.id)} aria-label={`Delete ${p.name}`}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Products — /shop/products
export default function Products() {
  return (
    <RequireShop>
      <ProductList />
    </RequireShop>
  )
}
