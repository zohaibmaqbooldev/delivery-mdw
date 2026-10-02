import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch } from '../../lib/format'
import { VEHICLES } from '../../context/RiderContext'
import { ActivePill, FilterChips, SearchBox } from '../../components/admin/ui'
import { EmptyState, ErrorState, ImageTile, PageHeader, Skeleton } from '../../components/user/ui'

export const ACTIVE_DELIVERY = ['assigned', 'accepted', 'picked_up', 'out_for_delivery']

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting approval' },
  { key: 'online', label: 'Online' },
  { key: 'inactive', label: 'Deactivated' },
]

export function OnlinePill({ online }) {
  return <span className={`pill ${online ? 'pill-success' : 'pill-neutral'}`}>{online ? 'Online' : 'Offline'}</span>
}

/** Counts of active deliveries per delivery boy id. */
export async function activeDeliveryCounts() {
  const { data } = await supabase
    .from('orders')
    .select('delivery_boy_id')
    .in('delivery_status', ACTIVE_DELIVERY)
    .not('delivery_boy_id', 'is', null)
  const counts = {}
  for (const r of data ?? []) counts[r.delivery_boy_id] = (counts[r.delivery_boy_id] ?? 0) + 1
  return counts
}

// Delivery Boys — /admin/delivery
export default function DeliveryBoys() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filter = params.get('show') ?? 'all'
  const [state, setState] = useState({ loading: true, error: '', riders: [], counts: {} })

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
      .from('profiles')
      .select('id, name, email, phone, is_active, created_at, delivery_riders(avatar_url, vehicle_type, vehicle_number, is_online, is_approved)')
      .eq('role', 'delivery')
      .order('created_at', { ascending: false })
    const term = cleanSearch(q)
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    if (filter === 'inactive') query = query.eq('is_active', false)
    const [{ data, error }, counts] = await Promise.all([query, activeDeliveryCounts()])
    let riders = data ?? []
    if (filter === 'online') riders = riders.filter((r) => r.delivery_riders?.is_online && r.is_active)
    if (filter === 'pending') riders = riders.filter((r) => !r.delivery_riders?.is_approved)
    setState({ loading: false, error: error ? error.message : '', riders, counts })
  }, [q, filter])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = useCallback((t) => setParam('q', t), [setParam])
  const { loading, error, riders, counts } = state

  return (
    <div className="admin-page">
      <PageHeader title="Delivery Boys" subtitle="Riders, their status and current deliveries." />
      <SearchBox value={q} onSearch={onSearch} placeholder="Search name, email or phone" />
      <FilterChips label="Filter delivery boys" options={FILTERS} value={filter} onChange={(k) => setParam('show', k)} />
      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : riders.length === 0 ? (
        <EmptyState title="No delivery boys match" />
      ) : (
        <ul className="admin-card-list">
          {riders.map((r) => {
            const d = r.delivery_riders
            const vehicle = [VEHICLES[d?.vehicle_type], d?.vehicle_number].filter(Boolean).join(' · ')
            return (
              <li key={r.id} className="card admin-row-card">
                <ImageTile src={d?.avatar_url} name={r.name || r.email} className="admin-row-img avatar-img" />
                <div className="admin-row-info">
                  <span className="strong">{r.name || r.email}</span>
                  <span className="muted small">
                    {r.phone || 'No phone'} {vehicle && `· ${vehicle}`}
                  </span>
                  <span className="row gap wrap">
                    {d?.is_approved ? <OnlinePill online={Boolean(d?.is_online)} /> : <span className="pill pill-warn">Awaiting approval</span>}
                    {!r.is_active && <ActivePill active={false} />}
                    <span className="small">
                      {counts[r.id] ?? 0} active {(counts[r.id] ?? 0) === 1 ? 'delivery' : 'deliveries'}
                    </span>
                  </span>
                </div>
                <Link to={`/admin/delivery/${r.id}`} className="btn btn-outline btn-sm" aria-label={`View ${r.name || r.email}`}>
                  View
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
