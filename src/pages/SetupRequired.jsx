import { keyProblem } from '../lib/supabase'

export default function SetupRequired() {
  if (keyProblem === 'invalid') {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1 className="h2">Supabase key not recognised</h1>
          <p className="muted">
            <code>SUPABASE_ANON_KEY</code> doesn't look like a Supabase anon / publishable key. Copy it again from Supabase → Project
            Settings → API, update the environment variable, and redeploy.
          </p>
        </div>
      </div>
    )
  }
  if (keyProblem) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h1 className="h2">Wrong Supabase key</h1>
          <p className="muted">
            The configured key is a <strong>{keyProblem}</strong> key, which must never be used in a website. Replace it with the{' '}
            <strong>anon / publishable</strong> key from Supabase → Project Settings → API, and rotate the leaked secret key in Supabase.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1 className="h2">Supabase is not configured</h1>
        <p className="muted">
          On Vercel, add the environment variables <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> (Project → Settings →
          Environment Variables) and redeploy. For local development, set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>.
        </p>
      </div>
    </div>
  )
}
