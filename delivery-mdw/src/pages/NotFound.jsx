import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="center-screen">
      <div className="card narrow center">
        <p className="eyebrow">404</p>
        <h1 className="h2">Page not found</h1>
        <p className="muted">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </div>
  )
}
