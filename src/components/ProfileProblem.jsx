import { useAuth } from '../context/AuthContext'

export default function ProfileProblem({ message }) {
  const { signOut, refreshProfile } = useAuth()

  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1 className="h2">We couldn't load your profile</h1>
        <p className="muted">
          {message || 'Your account has no role assigned.'} If this keeps happening, contact an
          administrator.
        </p>
        <div className="row gap">
          <button className="btn btn-primary" onClick={refreshProfile}>
            Try again
          </button>
          <button className="btn btn-ghost" onClick={signOut}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
