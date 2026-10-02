import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import LoadingScreen from './LoadingScreen'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} Delivery MDW</div>
      </footer>
    </div>
  )
}
