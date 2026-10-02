import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../components/user/ui'

export default function Login() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const cameFromProtected = Boolean(location.state?.from)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setSubmitting(false)
    if (signInError) {
      setError(
        signInError.message === 'Email not confirmed'
          ? 'Please confirm your email address first — check your inbox for the link.'
          : signInError.message,
      )
    }
    // On success the auth listener updates the session and the route guard
    // sends the user to the dashboard for their role.
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-heading">
          <span className="eyebrow">Welcome back</span>
          <h1 className="h2">Continue your delivery flow</h1>
        </div>
        <p className="muted">Sign in to access your role-based dashboard.</p>

        {cameFromProtected && !error && (
          <div className="alert alert-info">Please log in to view that page.</div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {friendlyError(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form" noValidate={false}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-forgot">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <p className="auth-switch">
          New to Delivery MDW? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
