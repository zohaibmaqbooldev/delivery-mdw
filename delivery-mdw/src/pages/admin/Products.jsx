import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch, formatPrice, isUuid } from '../../lib/format'
import { FilterChips, SearchBox } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'disabled', label: 'Disabled by admin' },
  { key: 'unavailable', label: 'Unavailable' },
]

export function ProductState({ product }) {
  if (product.is_disabled) return <span className="pill pill-danger">Disabled by admin</span>
  return (
    <span className={`pill ${product.is_available ? 'pill-success' : 'pill-neutral'}`}>
      {product.is_available ? 'Available' : 'Unavailable'}
    </span>
  )
}

// Products — /admin/products  (?q= search, ?show= filter, ?shop= one shop)
export default function Products() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = params.get('show') ?? 'all'
  const shopId = isUuid(params.get('shop')) ? params.get('shop') : null
  const [state, setState] = useState({ loading: true, error: '', products: [] })

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params)
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    let query = supabase
      .from('products')
      .select('id, name, price, image_url, is_available, is_disabled, shop:shops(id, name), categories(name)')
      .order('created_at', { ascending: false })
      .limit(300)
    const term = cleanSearch(q)
    if (term) query = query.ilike('name', `%${term}%`)
    if (filter === 'disabled') query = query.eq('is_disabled', true)
    if (filter === 'unavailable') query = query.eq('is_available', false)
    if (shopId) query = query.eq('shop_id', shopId)
    const { data, error } = await query
    setState({ loading: false, error: error ? error.message : '', products: data ?? [] })
  }, [q, filter, shopId])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = useCallback((t) => setParam('q', t), [setParam])
  const { loading, error, products } = state
  const shopName = shopId && products[0]?.shop?.name

  return (
    <div className="admin-page">
      <PageHeader title="Products" subtitle={shopId ? `Products of ${shopName ?? 'one shop'}` : 'Every product from every shop.'} />
      {shopId && (
        <p className="filter-note">
          <Link to="/admin/products">Show all shops</Link>
        </p>
      )}
      <SearchBox value={q} onSearch={onSearch} placeholder="Search product name" />
      <FilterChips label="Filter products" options={FILTERS} value={filter} onChange={(k) => setParam('show', k)} />
      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : products.length === 0 ? (
        <EmptyState title="No products match" />
      ) : (
        <ul className="admin-card-list">
          {products.map((p) => (
            <li key={p.id} className="card admin-row-card">
              <ImageTile src={p.image_url} name={p.name} className="admin-row-img" />
              <div className="admin-row-info">
                <span className="strong">{p.name}</span>
                <span className="muted small">
                  {p.shop?.name ?? '—'}
                  {p.categories?.name && ` · ${p.categories.name}`}
                </span>
                <span className="row gap wrap">
                  <span className="price">{formatPrice(p.price)}</span>
                  <ProductState product={p} />
                </span>
              </div>
              <Link to={`/admin/products/${p.id}`} className="btn btn-outline btn-sm" aria-label={`View ${p.name}`}>
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
