import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, ShopCard, Skeleton } from '../../components/user/ui'

const SHOP_FIELDS = 'id, name, image_url, location, is_open, delivery_fee'

// Shops — /user/shops  (supports ?q=search and ?category=slug)
export default function Shops() {
  const [params, setParams] = useSearchParams()
  const q = cleanSearch(params.get('q'))
  const categorySlug = params.get('category') ?? ''
  const urlTerm = params.get('q') ?? ''
  const [term, setTerm] = useState(urlTerm)
  const [syncedTerm, setSyncedTerm] = useState(urlTerm)
  if (syncedTerm !== urlTerm) {
    setSyncedTerm(urlTerm)
    setTerm(urlTerm)
  }
  const [categories, setCategories] = useState([])
  const [state, setState] = useState({ loading: true, error: '', shops: [] })

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, slug')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const category = categories.find((c) => c.slug === categorySlug)

  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    // Ignore results from an older search that finishes after a newer one.
    const done = (next) => id === requestId.current && setState(next)
    setState((s) => ({ ...s, loading: true, error: '' }))

    // Narrow the shop list to shops that sell matching products, if filtering.
    let shopIds = null
    let matchedByName = []

    if (categorySlug) {
      const { data: cat, error } = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle()
      if (error) return done({ loading: false, error: error.message, shops: [] })
      if (!cat) return done({ loading: false, error: '', shops: [] })
      const { data, error: pErr } = await supabase
        .from('products')
        .select('shop_id')
        .eq('category_id', cat.id)
        .eq('is_available', true)
      if (pErr) return done({ loading: false, error: pErr.message, shops: [] })
      shopIds = [...new Set(data.map((r) => r.shop_id))]
    }

    if (q) {
      const [byShop, byProduct] = await Promise.all([
        supabase.from('shops').select('id').or(`name.ilike.%${q}%,location.ilike.%${q}%`),
        supabase.from('products').select('shop_id').ilike('name', `%${q}%`).eq('is_available', true),
      ])
      const err = byShop.error || byProduct.error
      if (err) return done({ loading: false, error: err.message, shops: [] })
      matchedByName = [...new Set([...byShop.data.map((r) => r.id), ...byProduct.data.map((r) => r.shop_id)])]
      shopIds = shopIds ? shopIds.filter((id) => matchedByName.includes(id)) : matchedByName
    }

    if (shopIds && shopIds.length === 0) return done({ loading: false, error: '', shops: [] })

    let query = supabase
      .from('shops')
      .select(SHOP_FIELDS)
      .eq('is_active', true)
      .order('is_open', { ascending: false })
      .order('name')
    if (shopIds) query = query.in('id', shopIds)

    const { data, error } = await query
    done({ loading: false, error: error ? error.message : '', shops: data ?? [] })
  }, [q, categorySlug])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (term.trim()) next.set('q', term.trim())
    else next.delete('q')
    setParams(next)
  }

  function setCategory(slug) {
    const next = new URLSearchParams(params)
    if (slug) next.set('category', slug)
    else next.delete('category')
    setParams(next)
  }

  const filtering = Boolean(q || categorySlug)
  const { loading, error, shops } = state

  return (
    <div className="container user-content">
      <PageHeader title="Shops" subtitle="Browse shops that deliver through Delivery MDW." />

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

      <div className="chips" role="group" aria-label="Filter by category">
        <button type="button" className={`chip ${!categorySlug ? 'is-active' : ''}`} onClick={() => setCategory('')}>
          All
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`chip ${categorySlug === c.slug ? 'is-active' : ''}`}
            aria-pressed={categorySlug === c.slug}
            onClick={() => setCategory(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {filtering && !loading && (
        <p className="filter-note muted">
          {shops.length} {shops.length === 1 ? 'shop' : 'shops'}
          {q && (
            <>
              {' '}
              matching “<strong>{q}</strong>”
            </>
          )}
          {category && (
            <>
              {' '}
              in <strong>{category.name}</strong>
            </>
          )}
          .{' '}
          <Link to="/user/shops">Clear filters</Link>
        </p>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <Skeleton rows={3} />
      ) : shops.length === 0 ? (
        <EmptyState
          title={filtering ? 'No shops found' : 'No shops yet'}
          text={filtering ? 'Try a different search or category.' : 'Shops will appear here as soon as they join.'}
        />
      ) : (
        <div className="shop-grid">
          {shops.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      )}
    </div>
  )
}
