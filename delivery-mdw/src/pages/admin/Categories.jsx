import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ErrorState, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function friendly(error) {
  if (!error) return ''
  if (error.code === '23505') return 'A category with that name already exists.'
  if (error.code === '23514') return 'Category names must be 2–40 characters.'
  return error.message
}

function CategoryRow({ category, count, onChanged, others }) {
  const [mode, setMode] = useState('view') // view | edit | delete
  const [name, setName] = useState(category.name)
  const [sort, setSort] = useState(String(category.sort_order))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const clean = name.trim()
    if (clean.length < 2 || clean.length > 40) return setError('Category names must be 2–40 characters.')
    const slug = slugify(clean)
    if (!slug) return setError('Use at least one letter or number.')
    if (others.some((c) => c.slug === slug || c.name.toLowerCase() === clean.toLowerCase()))
      return setError('A category with that name already exists.')
    setBusy(true)
    const { error: err } = await supabase
      .from('categories')
      .update({ name: clean, slug, sort_order: Number(sort) || 0 })
      .eq('id', category.id)
    setBusy(false)
    if (err) return setError(friendly(err))
    setError('')
    setMode('view')
    onChanged()
  }

  async function remove() {
    setBusy(true)
    const { error: err } = await supabase.from('categories').delete().eq('id', category.id)
    setBusy(false)
    if (err) return setError(friendly(err))
    onChanged()
  }

  return (
    <li className="card category-row">
      {mode === 'edit' ? (
        <form className="category-edit" onSubmit={save}>
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={`New name for ${category.name}`} />
          </label>
          <label className="field category-sort">
            <span>Order</span>
            <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
          </label>
          <div className="row gap wrap">
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : mode === 'delete' ? (
        <div className="confirm-box" role="group" aria-label={`Confirm delete ${category.name}`}>
          <p>
            Delete <strong>{category.name}</strong>?{' '}
            {count > 0 ? `Its ${count} ${count === 1 ? 'product stays' : 'products stay'} for sale without a category.` : 'No products use it.'}
          </p>
          <div className="row gap wrap">
            <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('view')} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="category-view">
          <div>
            <span className="strong d-block">{category.name}</span>
            <span className="muted small">
              {count} {count === 1 ? 'product' : 'products'} · order {category.sort_order}
            </span>
          </div>
          <div className="row gap">
            <button className="btn btn-outline btn-sm" onClick={() => setMode('edit')} aria-label={`Edit ${category.name}`}>
              Edit
            </button>
            <button className="btn btn-ghost btn-sm danger-text" onClick={() => setMode('delete')} aria-label={`Delete ${category.name}`}>
              Delete
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
    </li>
  )
}

// Categories — /admin/categories
export default function Categories() {
  const [state, setState] = useState({ loading: true, error: '', categories: [], counts: {} })
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    const [cats, prods] = await Promise.all([
      supabase.from('categories').select('id, name, slug, sort_order').order('sort_order').order('name'),
      supabase.from('products').select('category_id').not('category_id', 'is', null),
    ])
    const counts = {}
    for (const p of prods.data ?? []) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1
    const error = cats.error || prods.error
    setState({ loading: false, error: error ? error.message : '', categories: cats.data ?? [], counts })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    setAddError('')
    const clean = name.trim()
    if (clean.length < 2 || clean.length > 40) return setAddError('Category names must be 2–40 characters.')
    const slug = slugify(clean)
    if (!slug) return setAddError('Use at least one letter or number.')
    if (state.categories.some((c) => c.slug === slug || c.name.toLowerCase() === clean.toLowerCase()))
      return setAddError('A category with that name already exists.')
    const nextSort = Math.max(0, ...state.categories.map((c) => c.sort_order)) + 1
    setAdding(true)
    const { error } = await supabase.from('categories').insert({ name: clean, slug, sort_order: nextSort })
    setAdding(false)
    if (error) return setAddError(friendly(error))
    setName('')
    load()
  }

  const { loading, error, categories, counts } = state

  return (
    <div className="admin-page narrow-admin">
      <PageHeader title="Categories" subtitle="Customers filter shops by these, and shops tag products with them." />

      <section className="card">
        <form className="category-add" onSubmit={add}>
          <label className="field">
            <span>New category</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frozen food" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={adding}>
            {adding ? 'Adding…' : 'Add category'}
          </button>
        </form>
        {addError && (
          <div className="alert alert-error" role="alert">
            {friendlyError(addError)}
          </div>
        )}
      </section>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <ul className="category-list">
          {categories.map((c) => (
            <CategoryRow
              key={`${c.id}-${c.name}-${c.sort_order}`}
              category={c}
              count={counts[c.id] ?? 0}
              onChanged={load}
              others={categories.filter((x) => x.id !== c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
