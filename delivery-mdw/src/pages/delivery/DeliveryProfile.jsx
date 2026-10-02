import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { RIDER_FIELDS, VEHICLES, useRider } from '../../context/RiderContext'
import { AwaitingApproval, OnlineToggle, RequireRider } from '../../components/delivery/DeliveryLayout'
import ImagePicker from '../../components/shop/ImagePicker'
import { AVATAR_BUCKET, removeImage, uploadImage } from '../../lib/images'
import { formatDate } from '../../lib/format'
import { ImageTile, PageHeader, friendlyError } from '../../components/user/ui'

const PHONE_RE = /^[+0-9][0-9 -]{6,19}$/

function EditForm({ onDone, onCancel }) {
  const { user, profile, refreshProfile } = useAuth()
  const { rider, setRider } = useRider()
  const [form, setForm] = useState({
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    vehicle_type: rider.vehicle_type ?? '',
    vehicle_number: rider.vehicle_number ?? '',
    image: { file: null, url: rider.avatar_url, removed: false },
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const phone = form.phone.trim()
    const vehicleNumber = form.vehicle_number.trim().toUpperCase()
    if (name.length < 2) return setError('Please enter your full name.')
    if (!PHONE_RE.test(phone)) return setError('Please enter a valid phone number. Customers and shops use it to reach you.')
    if (vehicleNumber.length > 20) return setError('Vehicle number is too long.')

    setSaving(true)
    let newUrl = null
    try {
      if (form.image.file) newUrl = await uploadImage(user.id, form.image.file, 'avatar', AVATAR_BUCKET)
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }
    const oldUrl = rider.avatar_url
    const avatar_url = newUrl ?? (form.image.removed ? null : oldUrl)

    const [p, r] = await Promise.all([
      supabase.from('profiles').update({ name, phone }).eq('id', user.id),
      supabase
        .from('delivery_riders')
        .update({ avatar_url, vehicle_type: form.vehicle_type || null, vehicle_number: vehicleNumber || null })
        .eq('id', user.id)
        .select(RIDER_FIELDS)
        .single(),
    ])
    const err = p.error || r.error
    if (err) {
      if (newUrl && r.error) await removeImage(newUrl, AVATAR_BUCKET)
      setSaving(false)
      return setError(err.message)
    }
    if (oldUrl && oldUrl !== avatar_url) await removeImage(oldUrl, AVATAR_BUCKET)
    setRider(r.data)
    await refreshProfile()
    setSaving(false)
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <ImagePicker label="Profile image" name={form.name} value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
      <label className="field">
        <span>Full name</span>
        <input autoComplete="name" required value={form.name} onChange={update('name')} />
      </label>
      <label className="field">
        <span>Phone</span>
        <input type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={update('phone')} />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={profile.email} disabled readOnly />
        <small className="muted">Email can't be changed here.</small>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Vehicle</span>
          <select value={form.vehicle_type} onChange={update('vehicle_type')}>
            <option value="">Not set</option>
            {Object.entries(VEHICLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Vehicle number <span className="optional">(optional)</span>
          </span>
          <input maxLength={20} value={form.vehicle_number} onChange={update('vehicle_number')} placeholder="e.g. LEB-1234" />
        </label>
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {friendlyError(error)}
        </div>
      )}
      <div className="row gap wrap">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ProfileView() {
  const { profile, signOut } = useAuth()
  const { rider } = useRider()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function logout() {
    setSigningOut(true)
    await signOut()
    navigate('/', { replace: true })
  }

  const vehicle = [VEHICLES[rider.vehicle_type], rider.vehicle_number].filter(Boolean).join(' · ')

  return (
    <div className="container user-content narrow-page">
      <PageHeader title="Profile" subtitle="Your delivery account." />

      {saved && (
        <div className="alert alert-success" role="status">
          Profile updated.
        </div>
      )}

      {rider.is_approved ? <OnlineToggle /> : <AwaitingApproval />}

      <section className="card">
        {editing ? (
          <EditForm
            onCancel={() => setEditing(false)}
            onDone={() => {
              setEditing(false)
              setSaved(true)
            }}
          />
        ) : (
          <>
            <div className="shop-profile-head">
              <ImageTile src={rider.avatar_url} name={profile.name} className="shop-profile-img avatar-img" />
              <div>
                <h2 className="h2">{profile.name}</h2>
                <span className="badge badge-delivery">Delivery Boy</span>
              </div>
            </div>
            <dl className="details">
              <div>
                <dt>Phone</dt>
                <dd>{profile.phone || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="break">{profile.email}</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>{vehicle || '—'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`pill ${rider.is_online ? 'pill-success' : 'pill-neutral'}`}>
                    {rider.is_online ? 'Online' : 'Offline'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
            </dl>
            <div className="row gap wrap profile-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSaved(false)
                  setEditing(true)
                }}
              >
                Edit profile
              </button>
              <button className="btn btn-ghost" onClick={logout} disabled={signingOut}>
                {signingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// Delivery Profile — /delivery/profile
export default function DeliveryProfile() {
  return (
    <RequireRider>
      <ProfileView />
    </RequireRider>
  )
}
