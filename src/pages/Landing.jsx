import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath } from '../lib/roles'

const roles = [
  {
    key: 'user',
    title: 'Customers',
    text: 'Order from shops near you and follow each delivery until it reaches your door.',
    icon: (
      <path d="M4 5h2l2.2 9.2a1 1 0 0 0 1 .8h7.6a1 1 0 0 0 1-.8L19 8H7M10 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01" />
    ),
  },
  {
    key: 'shop',
    title: 'Shops',
    text: 'Receive orders, prepare them, and hand them over to a delivery rider.',
    icon: <path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />,
  },
  {
    key: 'delivery',
    title: 'Delivery Boys',
    text: 'Pick up from shops and deliver to customers, with every job in one list.',
    icon: (
      <path d="M3 16V7h10v9M13 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01" />
    ),
  },
  {
    key: 'admin',
    title: 'Admins',
    text: 'Oversee every account on the platform and keep operations running smoothly.',
    icon: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />,
  },
]

export default function Landing() {
  const { user, role } = useAuth()
  const signedIn = Boolean(user && role)

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Local delivery, organised</span>
            <h1>
              One platform for customers, shops <span className="accent">and riders.</span>
            </h1>
            <p className="lead">
              Delivery MDW turns local delivery into a premium flow — from order to doorstep — with real-time clarity for every role.
            </p>
            <div className="row gap wrap">
              {signedIn ? (
                <Link to={dashboardPath(role)} className="btn btn-primary btn-lg">
                  Go to your dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="btn btn-primary btn-lg">
                    Create an account
                  </Link>
                  <Link to="/login" className="btn btn-outline btn-lg">
                    Log in
                  </Link>
                </>
              )}
            </div>
            <div className="hero-meta row gap wrap" aria-label="Key metrics">
              <span className="meta-pill">12 min avg ETA</span>
              <span className="meta-pill">4 role dashboards</span>
              <span className="meta-pill">Live order tracking</span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-panel card">
              <div className="hero-badge-row">
                <span className="hero-badge">On-time</span>
                <span className="hero-badge soft">Live</span>
              </div>
              <svg viewBox="0 0 420 240" className="hero-illustration">
                <defs>
                  <linearGradient id="roadGlow" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ffd7b5" />
                    <stop offset="100%" stopColor="#ff8a3d" />
                  </linearGradient>
                </defs>
                <rect x="32" y="28" width="150" height="104" rx="18" fill="#fff" stroke="#f1d8c6" />
                <rect x="48" y="44" width="118" height="14" rx="7" fill="#ff8a3d" opacity="0.92" />
                <rect x="48" y="70" width="58" height="44" rx="12" fill="#fff4eb" />
                <rect x="112" y="70" width="46" height="44" rx="12" fill="#ffe4cc" />

                <g transform="translate(196 38)">
                  <path d="M56 20C56 8.9 64.9 0 76 0h44c11.1 0 20 8.9 20 20v31c0 18.6-12.8 34.4-30.2 38.8L101 94l-8.8-4.2C74.8 85.4 62 69.6 62 51V20h-6Zm54 0v42c0 7.7-6.3 14-14 14h-8.5z" fill="#fff" stroke="#f1d8c6" />
                  <path d="M72 62h42" stroke="#ff8a3d" strokeWidth="6" strokeLinecap="round" />
                  <path d="M102 42l12-14 6 6-12 14" fill="none" stroke="#ff8a3d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                <g transform="translate(150 120)">
                  <path d="M0 78c34-44 82-66 150-66 71 0 105 28 135 66" fill="none" stroke="url(#roadGlow)" strokeWidth="18" strokeLinecap="round" />
                  <path d="M0 78c34-44 82-66 150-66 71 0 105 28 135 66" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="10 12" strokeLinecap="round" />
                </g>

                <g transform="translate(72 138)">
                  <circle cx="12" cy="62" r="12" fill="#101820" opacity="0.9" />
                  <circle cx="80" cy="62" r="12" fill="#101820" opacity="0.9" />
                  <path d="M12 62h36l24-34h13l19 34" fill="none" stroke="#101820" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="36" y="26" width="26" height="18" rx="5" fill="#ff8a3d" />
                </g>
                <circle cx="325" cy="52" r="22" fill="#ff8a3d" opacity="0.9" />
                <path d="M320 52l5 5 10-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="hero-panel-footer">
                <div>
                  <strong>24/7</strong>
                  <span>Order support</span>
                </div>
                <div>
                  <strong>4.8/5</strong>
                  <span>Customer love</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Built around four roles</h2>
            <p className="muted">
              Every account has exactly one role, and each role sees its own dashboard.
            </p>
          </div>
          <div className="grid grid-4">
            {roles.map((r) => (
              <article key={r.key} className="card feature">
                <span className={`feature-icon tone-${r.key}`}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {r.icon}
                  </svg>
                </span>
                <h3>{r.title}</h3>
                <p className="muted">{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Getting started takes a minute</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <h3>Sign up</h3>
                <p className="muted">Create an account as a customer, a shop or a delivery boy.</p>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <h3>Log in</h3>
                <p className="muted">We recognise your role and take you to the right place.</p>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <h3>Use your dashboard</h3>
                <p className="muted">Everything for your role lives on one screen.</p>
              </div>
            </li>
          </ol>
          {!signedIn && (
            <div className="center">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create your account
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
