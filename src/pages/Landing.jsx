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
              Delivery MDW brings everyone involved in a local delivery into one place — each with a
              dashboard built for their part of the job.
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
          </div>

          <div className="hero-art" aria-hidden="true">
            <svg viewBox="0 40 360 210">
              <defs>
                <linearGradient id="road" x1="0" x2="1">
                  <stop offset="0" stopColor="var(--c-primary)" stopOpacity=".15" />
                  <stop offset="1" stopColor="var(--c-primary)" stopOpacity=".45" />
                </linearGradient>
              </defs>
              <path d="M20 230 C 110 150, 220 280, 340 170" fill="none" stroke="url(#road)" strokeWidth="14" strokeLinecap="round" />
              <path d="M20 230 C 110 150, 220 280, 340 170" fill="none" stroke="var(--c-surface)" strokeWidth="2" strokeDasharray="10 12" />
              <g transform="translate(22 150)">
                <rect width="74" height="60" rx="8" fill="var(--c-surface)" stroke="var(--c-border)" />
                <path d="M0 18h74" stroke="var(--c-border)" />
                <rect x="10" y="4" width="54" height="10" rx="3" fill="var(--c-primary)" opacity=".85" />
                <rect x="26" y="32" width="22" height="28" rx="3" fill="var(--c-primary-soft)" />
              </g>
              <g transform="translate(262 88)">
                <path d="M0 34 L40 4 L80 34 V78 H0Z" fill="var(--c-surface)" stroke="var(--c-border)" />
                <rect x="30" y="48" width="20" height="30" rx="3" fill="var(--c-accent)" opacity=".85" />
              </g>
              <g transform="translate(150 150)">
                <circle cx="12" cy="44" r="11" fill="none" stroke="var(--c-text)" strokeWidth="4" />
                <circle cx="62" cy="44" r="11" fill="none" stroke="var(--c-text)" strokeWidth="4" />
                <path d="M12 44 L30 20 H52 L62 44" fill="none" stroke="var(--c-text)" strokeWidth="4" strokeLinejoin="round" />
                <rect x="26" y="0" width="30" height="22" rx="4" fill="var(--c-primary)" />
              </g>
              <circle cx="302" cy="60" r="16" fill="var(--c-accent)" opacity=".9" />
            </svg>
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
