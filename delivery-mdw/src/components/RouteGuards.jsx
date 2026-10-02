import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/roles'
import LoadingScreen from './LoadingScreen'
import ProfileProblem from './ProfileProblem'
import AccountDisabled from './AccountDisabled'

/** Only signed-in users whose profile role is in `allow` can see the nested routes. */
export function ProtectedRoute({ allow }) {
  const { user, role, profile, profileError, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (profileError || !role) return <ProfileProblem message={profileError} />

  if (profile?.is_active === false) return <AccountDisabled />

  if (allow && !allow.includes(role)) {
    // Signed in, but this area belongs to another role: send them to their own dashboard.
    return <Navigate to={dashboardPath(role)} replace />
  }

  return <Outlet />
}

/** Login / signup pages: signed-in users are sent straight to their dashboard. */
export function PublicOnlyRoute() {
  const { user, role, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user && role) return <Navigate to={dashboardPath(role)} replace />

  return <Outlet />
}

/** `/dashboard` — a convenience link that resolves to the current user's dashboard. */
export function DashboardRedirect() {
  const { user, role, profileError, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: '/dashboard' }} />
  if (profileError || !role) return <ProfileProblem message={profileError} />

  return <Navigate to={dashboardPath(role)} replace />
}
