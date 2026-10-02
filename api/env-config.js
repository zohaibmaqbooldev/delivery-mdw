// Vercel Serverless Function served at /env-config.js (see the rewrite in vercel.json).
//
// It turns the project's Vercel Environment Variables into the PUBLIC runtime settings the
// static app reads (window.__MDW_CONFIG__), so no keys are written into the repository and
// no build step is needed.
//
//   SUPABASE_URL        https://<project-ref>.supabase.co
//   SUPABASE_ANON_KEY   the anon / publishable key (public by design; RLS protects the data)
//   MAP_TILE_URL, MAP_TILE_ATTRIBUTION, MAP_DEFAULT_CENTER   optional
//
// Safety: a service_role / secret key is NEVER sent to the browser. If one is configured by
// mistake, this function withholds it and the app shows a "wrong key" screen instead.

function keyRole(key) {
  if (!key) return ''
  if (/^sb_secret_/i.test(key)) return 'secret'
  if (/^sb_publishable_/i.test(key)) return 'anon'
  const parts = key.split('.')
  if (parts.length !== 3) return 'unknown'
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : 'unknown'
  } catch {
    return 'unknown'
  }
}

function cleanUrl(value) {
  const v = String(value || '').trim().replace(/\/+$/, '')
  if (!v) return ''
  try {
    const u = new URL(v)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol === 'https:' || (local && u.protocol === 'http:')) return u.origin
  } catch {
    /* fall through */
  }
  return ''
}

export function buildConfig(env) {
  const url = cleanUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL)
  const rawKey = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
  const role = keyRole(rawKey)
  const safeKey = role === 'anon' ? rawKey : ''
  let error = ''
  if (!url || !rawKey) error = 'missing'
  else if (role === 'secret' || role === 'service_role') error = 'secret'
  else if (role !== 'anon') error = 'invalid-key'
  return {
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: safeKey,
    MAP_TILE_URL: String(env.MAP_TILE_URL || '').trim(),
    MAP_TILE_ATTRIBUTION: String(env.MAP_TILE_ATTRIBUTION || '').trim(),
    MAP_DEFAULT_CENTER: String(env.MAP_DEFAULT_CENTER || '').trim(),
    CONFIG_ERROR: error,
  }
}

export default function handler(req, res) {
  const body = `window.__MDW_CONFIG__ = ${JSON.stringify(buildConfig(process.env)).replace(/</g, '\\u003c')};\n`
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(body)
}
