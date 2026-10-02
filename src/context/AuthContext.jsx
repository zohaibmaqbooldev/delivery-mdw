import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [profileLoadedFor, setProfileLoadedFor] = useState(null)

  // 1. Track the auth session.
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })

    // Keep this callback synchronous: awaiting other Supabase calls inside it
    // can deadlock the auth client. The profile is loaded in the effect below.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionReady(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  // 2. Load the profile (the source of truth for the role) whenever the user changes.
  const loadProfile = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, created_at, is_active, avatar_url')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      setProfile(null)
      setProfileError(error.message)
    } else if (!data) {
      setProfile(null)
      setProfileError('No profile was found for this account.')
    } else {
      setProfile(data)
      setProfileError(null)
    }
    setProfileLoadedFor(id)
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setProfileLoadedFor(null)
      return
    }
    loadProfile(userId)
  }, [userId, loadProfile])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Clear the local session even if the network call failed.
      await supabase.auth.signOut({ scope: 'local' })
    }
    // Don't leave private data behind on a shared device (older versions saved the last address).
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('mdw-address-')) localStorage.removeItem(key)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const loading = !sessionReady || (userId !== null && profileLoadedFor !== userId)

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      profileError,
      loading,
      signOut,
      refreshProfile: () => userId && loadProfile(userId),
    }),
    [session, profile, profileError, loading, signOut, userId, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
