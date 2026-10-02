import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SIGNUP_ROLES, roleLabel } from '../lib/roles'
import { friendlyError } from '../components/user/ui'

/** Shared password rule (signup and reset). Supabase Auth also enforces its own minimum. */
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.'
  if (pw.length > 72) return 'Password must be at most 72 characters.'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use both letters and numbers in your password.'
  return ''
}

const PHONE_RE = /^[+0-9][0-9 -]{6,19}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const roleHints = {
  user: 'Order from shops',
  shop: 'Sell and prepare orders',
  delivery: 'Deliver orders',
}

export default function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    role: 'user',
  })
  const [error, setError] = useState('')
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.name.trim().length < 2 || form.name.trim().length > 80) return setError('Please enter your full name (2–80 characters).')
    if (!EMAIL_RE.test(form.email.trim())) return setError('Please enter a valid email address.')
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) return setError('Please enter a valid phone number, e.g. 0300-1234567.')
    const pwProblem = passwordProblem(form.password)
    if (pwProblem) return setError(pwProblem)
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (!SIGNUP_ROLES.includes(form.role)) return setError('Please choose an account type.')

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        // Read by the database trigger that creates the profile row.
        data: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setSubmitting(false)

    if (signUpError) return setError(signUpError.message)

    if (!data.session) {
      // Email confirmation is enabled in Supabase: the user must confirm before logging in.
      setConfirmEmailSentTo(form.email.trim())
    }
    // With a session, the auth listener + route guard redirect to the role dashboard.
  }

  if (confirmEmailSentTo) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <h1 className="h2">Check your email</h1>
          <p className="muted">
            We sent a confirmation link to <strong>{confirmEmailSentTo}</strong>. Open it to activate
            your account, then log in.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="h2">Create your account</h1>
        <p className="muted">Choose how you'll use Delivery MDW.</p>

        {error && (
          <div className="alert alert-error" role="alert">
            {friendlyError(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <fieldset className="role-picker">
            <legend>Account type</legend>
            {SIGNUP_ROLES.map((r) => (
              <label key={r} className={`role-option ${form.role === r ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={form.role === r}
                  onChange={update('role')}
                />
                <span className="role-option-title">{roleLabel(r)}</span>
                <span className="role-option-hint">{roleHints[r]}</span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span>Full name</span>
            <input autoComplete="name" required value={form.name} onChange={update('name')} />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update('email')}
            />
          </label>
          <label className="field">
            <span>
              Phone <span className="optional">(optional)</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={update('phone')}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span id="signup-pw-label">Password</span>
              <input
                type="password"
                aria-labelledby="signup-pw-label"
                aria-describedby="signup-pw-hint"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={update('password')}
              />
              <small className="muted" id="signup-pw-hint">8+ characters, letters and numbers</small>
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.confirm}
                onChange={update('confirm')}
              />
            </label>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
