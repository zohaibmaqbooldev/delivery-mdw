import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, ImageTile, ShopCard, Skeleton } from '../../components/user/ui'

// User Home — /user
export default function UserDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [state, setState] = useState({ loading: true, error: '', shops: [], products: [], categories: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    const [shops, products, categories] = await Promise.all([
      supabase
        .from('shops')
        .select('id, name, image_url, location, is_open, delivery_fee')
        .eq('is_active', true)
        .order('is_open', { ascending: false })
        .order('name')
        .limit(6),
      supabase.rpc('popular_products', { p_limit: 8 }),
      supabase.from('categories').select('id, name, slug').order('sort_order'),
    ])
    const error = shops.error || products.error || categories.error
    setState({
      loading: false,
      error: error ? error.message : '',
      shops: shops.data ?? [],
      products: products.data ?? [],
      categories: categories.data ?? [],
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    const q = term.trim()
    navigate(q ? `/user/shops?q=${encodeURIComponent(q)}` : '/user/shops')
  }

  const firstName = profile?.name?.split(' ')[0]
  const { loading, error, shops, products, categories } = state

  return (
    <div className="container user-content">
      <section className="welcome">
        <p className="eyebrow">Customer</p>
        <h1 className="h1">Hello{firstName ? `, ${firstName}` : ''}</h1>
        <p className="muted">What would you like delivered today?</p>

        <form className="search" role="search" onSubmit={handleSearch}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search shops or products"
            aria-label="Search shops or products"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" type="submit">
            Search
          </button>
        </form>
      </section>

      {error && <ErrorState message={error} onRetry={load} />}

      <section className="block">
        <h2 className="h2 block-title">Categories</h2>
        {loading ? (
          <Skeleton rows={1} />
        ) : (
          <div className="chips">
            {categories.map((c) => (
              <Link key={c.id} to={`/user/shops?category=${c.slug}`} className="chip">
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <h2 className="h2 block-title">Available shops</h2>
          <Link to="/user/shops" className="see-all">
            See all
          </Link>
        </div>
        {loading ? (
          <Skeleton rows={2} />
        ) : shops.length === 0 ? (
          <EmptyState title="No shops yet" text="Shops will appear here as soon as they join Delivery MDW." />
        ) : (
          <div className="shop-grid">
            {shops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        )}
      </section>

      <section className="block">
        <h2 className="h2 block-title">Popular products</h2>
        {loading ? (
          <Skeleton rows={2} />
        ) : products.length === 0 ? (
          <EmptyState title="No products yet" text="Products from shops will show up here." />
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <Link key={p.id} to={`/user/shops/${p.shop_id}`} className="card product-tile">
                <ImageTile src={p.image_url} name={p.name} className="product-tile-img" />
                <div className="product-tile-body">
                  <span className="product-tile-name">{p.name}</span>
                  <span className="muted small">{p.shop_name}</span>
                  <span className="price">{formatPrice(p.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
