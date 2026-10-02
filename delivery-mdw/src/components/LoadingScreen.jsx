export default function LoadingScreen() {
  return (
    <div className="center-screen" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
