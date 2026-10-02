import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../components/user/ui'

// /forgot-password — ask Supabase Auth to email a password-reset link.
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.')
    setSubmitting(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    // Same message whether or not the email has an account, so nobody can probe which emails exist.
    if (err && !/rate limit|too many|429/i.test(err.message)) return setSent(true)
    if (err) return setError(err.message)
    setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="h2">Reset your password</h1>
        {sent ? (
          <>
            <p className="muted">
              If an account exists for <strong>{email.trim()}</strong>, we've emailed a link to reset the password. The link works once and
              expires after a short time.
            </p>
            <Link to="/login" className="btn btn-primary btn-block">
              Back to login
            </Link>
          </>
        ) : (
          <>
            <p className="muted">Enter your account email and we'll send you a reset link.</p>
            {error && (
              <div className="alert alert-error" role="alert">
                {friendlyError(error)}
              </div>
            )}
            <form className="form" onSubmit={submit} noValidate>
              <label className="field">
                <span>Email</span>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="auth-switch">
              Remembered it? <Link to="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
