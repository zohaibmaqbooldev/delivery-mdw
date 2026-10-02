import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/format'
import { roleLabel } from '../../lib/roles'
import { PageHeader, friendlyError } from '../../components/user/ui'

// Profile — /user/profile
export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  function startEdit() {
    setForm({ name: profile.name ?? '', phone: profile.phone ?? '' })
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
    if (phone && !/^[+0-9][0-9 -]{6,19}$/.test(phone)) return setError('Please enter a valid phone number.')

    setSaving(true)
    const { error: err } = await supabase
      .from('profiles')
      .update({ name, phone: phone || null })
      .eq('id', profile.id)
    if (err) {
      setSaving(false)
      return setError(err.message)
    }
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
    <div className="container user-content narrow-page">
      <PageHeader title="Profile" subtitle="Your account details." />

      {saved && (
        <div className="alert alert-success" role="status">
          Profile updated.
        </div>
      )}

      <section className="card">
        {editing ? (
          <form className="form" onSubmit={save}>
            <label className="field">
              <span>Full name</span>
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
            <dl className="details">
              <div>
                <dt>Name</dt>
                <dd>{profile.name || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="break">{profile.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{profile.phone || '—'}</dd>
              </div>
              <div>
                <dt>Account type</dt>
                <dd>
                  <span className={`badge badge-${profile.role}`}>{roleLabel(profile.role)}</span>
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
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
