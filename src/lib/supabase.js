import { createClient } from '@supabase/supabase-js'
import { config, unsafeKeyReason } from './config'

const { supabaseUrl, supabaseAnonKey } = config

// Never run with a privileged key in the browser.
// (On Vercel the /env-config.js function already withholds such a key and reports it.)
export const keyProblem =
  config.configError === 'secret' ? 'secret / service_role' : config.configError === 'invalid-key' ? 'invalid' : unsafeKeyReason(supabaseAnonKey)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !keyProblem)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
