import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/** The signed-in shop account's own shop (or null if it hasn't been set up yet). */
const MyShopContext = createContext(null)

export const SHOP_FIELDS =
  'id, owner_id, name, description, image_url, location, phone, delivery_fee, is_open, is_active, is_approved, created_at'

export function MyShopProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', shop: null })

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('shops').select(SHOP_FIELDS).eq('owner_id', user.id).maybeSingle()
    setState({ loading: false, error: error ? error.message : '', shop: data })
    return data
  }, [user.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setShop = useCallback((shop) => setState((s) => ({ ...s, shop })), [])

  const value = useMemo(() => ({ ...state, refresh, setShop }), [state, refresh, setShop])
  return <MyShopContext.Provider value={value}>{children}</MyShopContext.Provider>
}

export function useMyShop() {
  const ctx = useContext(MyShopContext)
  if (!ctx) throw new Error('useMyShop must be used inside <MyShopProvider>')
  return ctx
}
