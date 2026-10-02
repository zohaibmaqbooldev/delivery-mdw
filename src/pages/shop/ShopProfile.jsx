import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { SHOP_FIELDS, useMyShop } from '../../context/MyShopContext'
import { removeImage, uploadImage } from '../../lib/images'
import { formatPrice } from '../../lib/format'
import ImagePicker from '../../components/shop/ImagePicker'
import { ProfileCard } from '../../components/DashboardShell'
import { ErrorState, ImageTile, OpenBadge, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'

const PHONE_RE = /^[+0-9][0-9 -]{6,19}$/

function toForm(shop) {
  return {
    name: shop?.name ?? '',
    phone: shop?.phone ?? '',
    location: shop?.location ?? '',
    description: shop?.description ?? '',
    delivery_fee: shop ? String(Number(shop.delivery_fee)) : '0',
    is_open: shop?.is_open ?? false,
    image: { file: null, url: shop?.image_url ?? null, removed: false },
  }
}

function ShopForm({ shop, onDone, onCancel }) {
  const { user } = useAuth()
  const [form, setForm] = useState(() => toForm(shop))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const creating = !shop

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const phone = form.phone.trim()
    const location = form.location.trim()
    const fee = Number(form.delivery_fee)
    if (name.length < 2 || name.length > 60) return setError('Shop name must be 2–60 characters.')
    if (!PHONE_RE.test(phone)) return setError('Please enter a valid phone number.')
    if (location.length < 5) return setError('Please enter the shop address.')
    if (!Number.isFinite(fee) || fee < 0 || fee > 10000) return setError('Delivery fee must be between 0 and 10,000.')

    setSaving(true)
    let newImageUrl = null
    try {
      if (form.image.file) newImageUrl = await uploadImage(user.id, form.image.file, 'shop')
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }

    const oldImageUrl = shop?.image_url ?? null
    const image_url = newImageUrl ?? (form.image.removed ? null : oldImageUrl)
    const values = {
      name,
      phone,
      location,
      description: form.description.trim() || null,
      delivery_fee: fee,
      is_open: form.is_open,
      image_url,
    }

    const query = creating
      ? supabase.from('shops').insert({ ...values, owner_id: user.id })
      : supabase.from('shops').update(values).eq('id', shop.id)
    const { data, error: err } = await query.select(SHOP_FIELDS).single()

    if (err) {
      if (newImageUrl) await removeImage(newImageUrl)
      setSaving(false)
      return setError(err.message)
    }
    if (oldImageUrl && oldImageUrl !== image_url) await removeImage(oldImageUrl)
    setSaving(false)
    onDone(data)
  }

  return (
    <form className="form" onSubmit={submit}>
      <ImagePicker label="Shop image" name={form.name} value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
      <label className="field">
        <span>Shop name</span>
        <input required maxLength={60} value={form.name} onChange={update('name')} />
      </label>
      <label className="field">
        <span>Phone</span>
        <input type="tel" inputMode="tel" required value={form.phone} onChange={update('phone')} />
      </label>
      <label className="field">
        <span>Address</span>
        <textarea rows={2} required value={form.location} onChange={update('location')} placeholder="Street, area, city" />
      </label>
      <label className="field">
        <span>
          About the shop <span className="optional">(optional)</span>
        </span>
        <textarea rows={2} maxLength={300} value={form.description} onChange={update('description')} />
      </label>
      <label className="field">
        <span>Delivery fee (Rs)</span>
        <input type="number" inputMode="decimal" min="0" max="10000" step="1" required value={form.delivery_fee} onChange={update('delivery_fee')} />
      </label>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={form.is_open} onChange={update('is_open')} />
        <span className="switch" aria-hidden="true" />
        <span>Shop is open for orders</span>
      </label>

      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
      <div className="row gap wrap">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : creating ? 'Create shop' : 'Save changes'}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// Shop Profile — /shop/profile
export default function ShopProfile() {
  const { loading, error, shop, refresh, setShop } = useMyShop()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState('')

  if (loading) {
    return (
      <div className="container user-content narrow-page">
        <Skeleton rows={3} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="container user-content narrow-page">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="container user-content narrow-page">
        <PageHeader title="Set up your shop" subtitle="Customers see these details when they browse shops." />
        <section className="card">
          <ShopForm
            shop={null}
            onDone={(s) => {
              setShop(s)
              setNotice('Your shop is set up. Add some products next.')
            }}
          />
        </section>
        <ProfileCard />
      </div>
    )
  }

  async function toggleOpen() {
    setToggling(true)
    setToggleError('')
    const { data, error: err } = await supabase
      .from('shops')
      .update({ is_open: !shop.is_open })
      .eq('id', shop.id)
      .select(SHOP_FIELDS)
      .single()
    setToggling(false)
    if (err) return setToggleError(err.message)
    setShop(data)
  }

  return (
    <div className="container user-content narrow-page">
      <PageHeader title="Shop profile" subtitle="What customers see about your shop." />

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="card open-card">
        <div>
          <span className="strong d-block">{shop.is_open ? 'Your shop is open' : 'Your shop is closed'}</span>
          <span className="muted small">
            {shop.is_open ? 'Customers can place orders.' : 'Customers can browse but not order.'}
          </span>
        </div>
        <button className={`btn ${shop.is_open ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleOpen} disabled={toggling}>
          {toggling ? 'Saving…' : shop.is_open ? 'Close shop' : 'Open shop'}
        </button>
      </section>
      {toggleError && <ErrorState message={toggleError} />}

      <section className="card">
        {editing ? (
          <ShopForm
            shop={shop}
            onCancel={() => setEditing(false)}
            onDone={(s) => {
              setShop(s)
              setEditing(false)
              setNotice('Shop details saved.')
            }}
          />
        ) : (
          <>
            <div className="shop-profile-head">
              <ImageTile src={shop.image_url} name={shop.name} className="shop-profile-img" />
              <div>
                <h2 className="h2">{shop.name}</h2>
                <OpenBadge isOpen={shop.is_open} />
                {!shop.is_active && <span className="pill pill-danger">Hidden by admin</span>}
              </div>
            </div>
            <dl className="details">
              <div>
                <dt>Phone</dt>
                <dd>{shop.phone || '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd className="break">{shop.location || '—'}</dd>
              </div>
              <div>
                <dt>About</dt>
                <dd className="break">{shop.description || '—'}</dd>
              </div>
              <div>
                <dt>Delivery fee</dt>
                <dd>{Number(shop.delivery_fee) > 0 ? formatPrice(shop.delivery_fee) : 'Free'}</dd>
              </div>
            </dl>
            <div className="profile-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setNotice('')
                  setEditing(true)
                }}
              >
                Edit shop
              </button>
            </div>
          </>
        )}
      </section>

      <ProfileCard />
    </div>
  )
}
