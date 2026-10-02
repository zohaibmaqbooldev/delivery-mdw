import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { removeImage, uploadImage } from '../../lib/images'
import ImagePicker from './ImagePicker'
import { friendlyError } from '../user/ui'

const FIELDS = 'id, shop_id, category_id, name, description, price, image_url, is_available, created_at'

/** Used by Add Product (product = null) and Edit Product. Calls onSaved(product) on success. */
export default function ProductForm({ shopId, product, onSaved, onCancel }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(Number(product.price)) : '',
    category_id: product?.category_id ? String(product.category_id) : '',
    is_available: product?.is_available ?? true,
    image: { file: null, url: product?.image_url ?? null, removed: false },
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const price = Number(form.price)
    if (name.length < 2 || name.length > 80) return setError('Product name must be 2–80 characters.')
    if (form.price === '' || !Number.isFinite(price) || price < 0 || price > 1000000)
      return setError('Price must be a number between 0 and 1,000,000.')
    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) return setError('Price can have at most 2 decimal places.')

    setSaving(true)
    let newImageUrl = null
    try {
      if (form.image.file) newImageUrl = await uploadImage(user.id, form.image.file, 'product')
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }

    const oldImageUrl = product?.image_url ?? null
    const image_url = newImageUrl ?? (form.image.removed ? null : oldImageUrl)
    const values = {
      name,
      description: form.description.trim() || null,
      price,
      category_id: form.category_id ? Number(form.category_id) : null,
      is_available: form.is_available,
      image_url,
    }

    const query = product
      ? supabase.from('products').update(values).eq('id', product.id).eq('shop_id', shopId)
      : supabase.from('products').insert({ ...values, shop_id: shopId })
    const { data, error: err } = await query.select(FIELDS).maybeSingle()

    if (err || !data) {
      if (newImageUrl) await removeImage(newImageUrl)
      setSaving(false)
      return setError(err ? err.message : 'This product could not be saved.')
    }
    if (oldImageUrl && oldImageUrl !== image_url) await removeImage(oldImageUrl)
    setSaving(false)
    onSaved(data)
  }

  return (
    <form className="form" onSubmit={submit}>
      <ImagePicker label="Product image" name={form.name} value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
      <label className="field">
        <span>Product name</span>
        <input required maxLength={80} value={form.name} onChange={update('name')} />
      </label>
      <label className="field">
        <span>
          Description <span className="optional">(optional)</span>
        </span>
        <textarea rows={3} maxLength={300} value={form.description} onChange={update('description')} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Price (Rs)</span>
          <input type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={form.price} onChange={update('price')} />
        </label>
        <label className="field">
          <span>
            Category <span className="optional">(optional)</span>
          </span>
          <select value={form.category_id} onChange={update('category_id')}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={form.is_available} onChange={update('is_available')} />
        <span className="switch" aria-hidden="true" />
        <span>Available for customers to order</span>
      </label>

      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
      <div className="row gap wrap">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
