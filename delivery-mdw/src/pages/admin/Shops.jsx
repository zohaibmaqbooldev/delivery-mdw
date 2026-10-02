import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch } from '../../lib/format'
import { FilterChips, SearchBox } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, OpenBadge, PageHeader, Skeleton } from '../../components/user/ui'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'disabled', label: 'Disabled' },
]

export function ShopState({ shop }) {
  if (!shop.is_active) return <span className="pill pill-danger">Disabled</span>
  if (!shop.is_approved) return <span className="pill pill-warn">Awaiting approval</span>
  return <span className="pill pill-success">Approved</span>
}

// Shops — /admin/shops
export default function Shops() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = params.get('show') ?? 'all'
  const [state, setState] = useState({ loading: true, error: '', shops: [] })

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
      .from('shops')
      .select('id, name, image_url, location, is_open, is_active, is_approved, created_at, owner:profiles!shops_owner_id_fkey(name, email)')
      .order('is_approved', { ascending: true })
      .order('created_at', { ascending: false })
    const term = cleanSearch(q)
    if (term) query = query.or(`name.ilike.%${term}%,location.ilike.%${term}%`)
    if (filter === 'pending') query = query.eq('is_approved', false).eq('is_active', true)
    if (filter === 'approved') query = query.eq('is_approved', true).eq('is_active', true)
    if (filter === 'disabled') query = query.eq('is_active', false)
    const { data, error } = await query
    setState({ loading: false, error: error ? error.message : '', shops: data ?? [] })
  }, [q, filter])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = useCallback((t) => setParam('q', t), [setParam])
  const { loading, error, shops } = state

  return (
    <div className="admin-page">
      <PageHeader title="Shops" subtitle="Approve new shops and disable shops that shouldn't be selling." />
      <SearchBox value={q} onSearch={onSearch} placeholder="Search shop name or location" />
      <FilterChips label="Filter shops" options={FILTERS} value={filter} onChange={(k) => setParam('show', k)} />
      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : shops.length === 0 ? (
        <EmptyState title="No shops match" />
      ) : (
        <ul className="admin-card-list">
          {shops.map((s) => (
            <li key={s.id} className="card admin-row-card">
              <ImageTile src={s.image_url} name={s.name} className="admin-row-img" />
              <div className="admin-row-info">
                <span className="strong">{s.name}</span>
                <span className="muted small">{s.location || 'No address'}</span>
                <span className="muted small">Owner: {s.owner?.name || s.owner?.email || '—'}</span>
                <span className="row gap wrap">
                  <ShopState shop={s} />
                  <OpenBadge isOpen={s.is_open} />
                </span>
              </div>
              <Link to={`/admin/shops/${s.id}`} className="btn btn-outline btn-sm" aria-label={`View ${s.name}`}>
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
