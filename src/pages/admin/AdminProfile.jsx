import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ImagePicker from '../../components/shop/ImagePicker'
import { AVATAR_BUCKET, removeImage, uploadImage } from '../../lib/images'
import { formatDate } from '../../lib/format'
import { ImageTile, PageHeader, friendlyError } from '../../components/user/ui'

const PHONE_RE = /^[+0-9][0-9 -]{6,19}$/

// Admin Profile — /admin/profile
export default function AdminProfile() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  function startEdit() {
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      image: { file: null, url: profile.avatar_url, removed: false },
    })
    setError('')
    setSaved(false)
    setEditing(true)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const name = form.name.trim()
    const phone = form.phone.trim()
    if (name.length < 2) return setError('Please enter your full name.')
    if (phone && !PHONE_RE.test(phone)) return setError('Please enter a valid phone number.')

    setSaving(true)
    let newUrl = null
    try {
      if (form.image.file) newUrl = await uploadImage(user.id, form.image.file, 'avatar', AVATAR_BUCKET)
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }
    const oldUrl = profile.avatar_url
    const avatar_url = newUrl ?? (form.image.removed ? null : oldUrl)
    const { error: err } = await supabase.from('profiles').update({ name, phone: phone || null, avatar_url }).eq('id', user.id)
    if (err) {
      if (newUrl) await removeImage(newUrl, AVATAR_BUCKET)
      setSaving(false)
      return setError(err.message)
    }
    if (oldUrl && oldUrl !== avatar_url) await removeImage(oldUrl, AVATAR_BUCKET)
    await refreshProfile()
    setSaving(false)
    setEditing(false)
    setSaved(true)
  }

  async function logout() {
    setSigningOut(true)
    await signOut()
    navigate('/', { replace: true })
  }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="admin-page narrow-admin">
      <PageHeader title="Profile" subtitle="Your admin account." />
      {saved && (
        <div className="alert alert-success" role="status">
          Profile updated.
        </div>
      )}
      <section className="card">
        {editing ? (
          <form className="form" onSubmit={save}>
            <ImagePicker label="Profile image" name={form.name} value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />
            <label className="field">
              <span>Name</span>
              <input autoComplete="name" required value={form.name} onChange={update('name')} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={profile.email} disabled readOnly />
              <small className="muted">Email can't be changed here.</small>
            </label>
            <label className="field">
              <span>
                Phone <span className="optional">(optional)</span>
              </span>
              <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} />
            </label>
            {error && (
              <div className="alert alert-error" role="alert">
                {friendlyError(error)}
              </div>
            )}
            <div className="row gap wrap">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="shop-profile-head">
              <ImageTile src={profile.avatar_url} name={profile.name || profile.email} className="shop-profile-img avatar-img" />
              <div>
                <h2 className="h2">{profile.name}</h2>
                <span className="badge badge-admin">Admin</span>
              </div>
            </div>
            <dl className="details">
              <div><dt>Name</dt><dd>{profile.name || '—'}</dd></div>
              <div><dt>Email</dt><dd className="break">{profile.email}</dd></div>
              <div><dt>Phone</dt><dd>{profile.phone || '—'}</dd></div>
              <div><dt>Member since</dt><dd>{formatDate(profile.created_at)}</dd></div>
            </dl>
            <div className="row gap wrap profile-actions">
              <button className="btn btn-primary" onClick={startEdit}>
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
