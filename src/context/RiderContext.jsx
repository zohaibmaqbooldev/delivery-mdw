import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/** The signed-in delivery boy's own details (vehicle, photo, online status). */
const RiderContext = createContext(null)

export const RIDER_FIELDS = 'id, avatar_url, vehicle_type, vehicle_number, is_online, is_approved'

export const VEHICLES = {
  motorbike: 'Motorbike',
  bicycle: 'Bicycle',
  rickshaw: 'Rickshaw',
  car: 'Car',
  van: 'Van',
}

export function RiderProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', rider: null })

  const refresh = useCallback(async () => {
    let { data, error } = await supabase.from('delivery_riders').select(RIDER_FIELDS).eq('id', user.id).maybeSingle()
    if (!error && !data) {
      // First visit: create this delivery boy's details row (starts offline).
      // "Ignore duplicates" makes this safe if two tabs/effects do it at once.
      const created = await supabase
        .from('delivery_riders')
        .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })
      error = created.error
      if (!error) {
        const res = await supabase.from('delivery_riders').select(RIDER_FIELDS).eq('id', user.id).single()
        data = res.data
        error = res.error
      }
    }
    setState({ loading: false, error: error ? error.message : '', rider: data })
    return data
  }, [user.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  // While waiting for admin approval, re-check whenever the app comes back into view,
  // so an approval shows up without logging out and in again.
  const waiting = state.rider && !state.rider.is_approved
  useEffect(() => {
    if (!waiting) return
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [waiting, refresh])

  const setRider = useCallback((rider) => setState((s) => ({ ...s, rider })), [])

  /** Going online may assign waiting orders; going offline hands back unaccepted ones. */
  const setOnline = useCallback(
    async (isOnline) => {
      const { data, error } = await supabase
        .from('delivery_riders')
        .update({ is_online: isOnline })
        .eq('id', user.id)
        .select(RIDER_FIELDS)
        .single()
      if (error) return error.message
      setRider(data)
      return ''
    },
    [user.id, setRider],
  )

  const value = useMemo(() => ({ ...state, refresh, setRider, setOnline }), [state, refresh, setRider, setOnline])
  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>
}

export function useRider() {
  const ctx = useContext(RiderContext)
  if (!ctx) throw new Error('useRider must be used inside <RiderProvider>')
  return ctx
}
