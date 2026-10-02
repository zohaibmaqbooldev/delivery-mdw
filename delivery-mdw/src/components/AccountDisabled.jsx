import { useAuth } from '../context/AuthContext'

export default function AccountDisabled() {
  const { signOut } = useAuth()
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1 className="h2">Your account is deactivated</h1>
        <p className="muted">
          An administrator has deactivated this account, so you can't use Delivery MDW right now. Please contact
          support if you think this is a mistake.
        </p>
        <button className="btn btn-primary" onClick={signOut}>
          Log out
        </button>
      </div>
    </div>
  )
}
