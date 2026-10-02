import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { cleanSearch, formatDate } from '../../lib/format'
import { roleLabel } from '../../lib/roles'
import { ActivePill, DataTable, FilterChips, SearchBox } from '../../components/admin/ui'
import { ErrorState, PageHeader, Skeleton } from '../../components/user/ui'

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'Customers' },
  { key: 'shop', label: 'Shops' },
  { key: 'delivery', label: 'Delivery Boys' },
  { key: 'admin', label: 'Admins' },
  { key: 'inactive', label: 'Deactivated' },
]

// Users — /admin/users
export default function Users() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const role = params.get('role') ?? 'all'
  const [state, setState] = useState({ loading: true, error: '', users: [] })

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
      .select('id, name, email, phone, role, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(300)
    const term = cleanSearch(q)
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    if (role === 'inactive') query = query.eq('is_active', false)
    else if (role !== 'all') query = query.eq('role', role)
    const { data, error } = await query
    setState({ loading: false, error: error ? error.message : '', users: data ?? [] })
  }, [q, role])

  useEffect(() => {
    load()
  }, [load])

  const onSearch = useCallback((t) => setParam('q', t), [setParam])
  const { loading, error, users } = state

  return (
    <div className="admin-page">
      <PageHeader title="Users" subtitle="Every account on Delivery MDW." />
      <SearchBox value={q} onSearch={onSearch} placeholder="Search name, email or phone" />
      <FilterChips label="Filter by role" options={ROLE_FILTERS} value={role} onChange={(k) => setParam('role', k)} />
      {error && <ErrorState message={error} onRetry={load} />}
      <section className="card">
        {loading ? (
          <Skeleton rows={4} />
        ) : (
          <>
            <p className="muted small">
              {users.length} {users.length === 1 ? 'account' : 'accounts'}
            </p>
            <DataTable
              rows={users}
              rowKey={(u) => u.id}
              empty="No accounts match."
              columns={[
                { label: 'Name', render: (u) => <Link to={`/admin/users/${u.id}`}>{u.name || '—'}</Link> },
                { label: 'Email', render: (u) => <span className="break">{u.email}</span> },
                { label: 'Phone', render: (u) => u.phone || '—' },
                { label: 'Role', render: (u) => <span className={`badge badge-${u.role}`}>{roleLabel(u.role)}</span> },
                { label: 'Status', render: (u) => <ActivePill active={u.is_active} /> },
                { label: 'Joined', render: (u) => formatDate(u.created_at) },
                {
                  label: 'Details',
                  render: (u) => (
                    <Link to={`/admin/users/${u.id}`} className="btn btn-outline btn-sm" aria-label={`View ${u.name || u.email}`}>
                      View
                    </Link>
                  ),
                },
              ]}
            />
          </>
        )}
      </section>
    </div>
  )
}
