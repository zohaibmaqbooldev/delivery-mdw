import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/roles'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ProfileCard() {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <section className="card">
      <h2 className="h3">Your profile</h2>
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
          <dt>Role</dt>
          <dd>
            <span className={`badge badge-${profile.role}`}>{roleLabel(profile.role)}</span>
          </dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{formatDate(profile.created_at)}</dd>
        </div>
      </dl>
    </section>
  )
}

export default function DashboardShell({ title, subtitle, children }) {
  const { profile } = useAuth()
  const firstName = profile?.name?.split(' ')[0]

  return (
    <div className="container dashboard">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">{title}</p>
          <h1 className="h1">Hello{firstName ? `, ${firstName}` : ''}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </div>
  )
}

export { formatDate }
