import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/roles'
import { friendlyError } from '../components/user/ui'
import LoadingScreen from '../components/LoadingScreen'
import { passwordProblem } from './Signup'

// /reset-password — opened from the reset email. Supabase signs the user in from the
// link (a short-lived recovery session); here they choose a new password.
export default function ResetPassword() {
  const { user, role, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (loading) return <LoadingScreen />

  if (!user) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1 className="h2">Link expired or already used</h1>
          <p className="muted">Password reset links work once and expire after a short time. Request a new one.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block">
            Send a new link
          </Link>
        </div>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== confirm) return setError('Passwords do not match.')
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) return setError(err.message)
    setDone(true)
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="h2">Choose a new password</h1>
        {done ? (
          <>
            <div className="alert alert-success" role="status">
              Your password has been changed.
            </div>
            <button className="btn btn-primary btn-block" onClick={() => navigate(dashboardPath(role), { replace: true })}>
              Continue to your dashboard
            </button>
          </>
        ) : (
          <>
            {error && (
              <div className="alert alert-error" role="alert">
                {friendlyError(error)}
              </div>
            )}
            <form className="form" onSubmit={submit} noValidate>
              <label className="field">
                <span id="reset-pw-label">New password</span>
                <input type="password" aria-labelledby="reset-pw-label" aria-describedby="reset-pw-hint" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                <small className="muted" id="reset-pw-hint">At least 8 characters, with letters and numbers.</small>
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
