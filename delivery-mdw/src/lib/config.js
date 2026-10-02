/*
 * Runtime settings. Two ways to provide them (public values only):
 *   1. /env-config.js  (window.__MDW_CONFIG__) — edit the file in the built `dist/`
 *      folder; used for the static Vercel deployment, no build step needed.
 *   2. VITE_* variables in `.env` — used by `npm run dev` / `vite build`.
 * The Supabase anon/publishable key is public by design (RLS protects the data).
 * A service_role / secret key must never be used here, so the app refuses to start with one.
 */
const runtime = (typeof window !== 'undefined' && window.__MDW_CONFIG__) || {}
const env = import.meta.env ?? {}

const pick = (runtimeKey, envKey) => {
  const v = runtime[runtimeKey] || env[envKey] || ''
  return typeof v === 'string' ? v.trim() : ''
}

export const config = {
  supabaseUrl: pick('SUPABASE_URL', 'VITE_SUPABASE_URL'),
  supabaseAnonKey: pick('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
  mapTileUrl: pick('MAP_TILE_URL', 'VITE_MAP_TILE_URL') || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapTileAttribution:
    pick('MAP_TILE_ATTRIBUTION', 'VITE_MAP_TILE_ATTRIBUTION') ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  mapDefaultCenter: pick('MAP_DEFAULT_CENTER', 'VITE_MAP_DEFAULT_CENTER'),
  // Set by the /env-config.js function on Vercel: 'missing' | 'secret' | 'invalid-key' | ''
  configError: typeof runtime.CONFIG_ERROR === 'string' ? runtime.CONFIG_ERROR : '',
}

/** Returns a reason if the key must not be used in a browser (service_role / secret key). */
export function unsafeKeyReason(key) {
  if (!key) return ''
  if (/^sb_secret_/i.test(key)) return 'secret'
  const parts = key.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role && payload.role !== 'anon') return payload.role
    } catch {
      return ''
    }
  }
  return ''
}
