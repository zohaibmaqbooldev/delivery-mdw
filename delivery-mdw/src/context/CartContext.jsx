import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

/*
 * The cart lives in the browser (per signed-in user) until the order is placed.
 * It holds items from ONE shop at a time, because each order goes to one shop.
 * Prices stored here are only for display; the database recalculates everything
 * when the order is placed.
 */

const CartContext = createContext(null)
const EMPTY = { shopId: null, shopName: '', items: [] }
const MAX_QTY = 99

function storageKey(userId) {
  return `mdw-cart-${userId}`
}

function readCart(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY
    return parsed
  } catch {
    return EMPTY
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [cart, setCart] = useState(() => (userId ? readCart(userId) : EMPTY))
  const [loadedFor, setLoadedFor] = useState(userId)

  // Switch carts if a different user signs in.
  if (loadedFor !== userId) {
    setLoadedFor(userId)
    setCart(userId ? readCart(userId) : EMPTY)
  }

  useEffect(() => {
    if (!userId) return
    try {
      if (cart.items.length === 0) localStorage.removeItem(storageKey(userId))
      else localStorage.setItem(storageKey(userId), JSON.stringify(cart))
    } catch {
      /* storage unavailable: cart still works for this visit */
    }
  }, [cart, userId])

  /** Returns { ok: true } or { ok: false, conflictShopName } when the cart holds another shop. */
  const addItem = useCallback(
    (shop, product) => {
      if (cart.items.length > 0 && cart.shopId !== shop.id) {
        return { ok: false, conflictShopName: cart.shopName }
      }
      setCart((c) => {
        const existing = c.items.find((i) => i.productId === product.id)
        const items = existing
          ? c.items.map((i) =>
              i.productId === product.id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) } : i,
            )
          : [
              ...c.items,
              { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 },
            ]
        return { shopId: shop.id, shopName: shop.name, items }
      })
      return { ok: true }
    },
    [cart.items.length, cart.shopId, cart.shopName],
  )

  const startNewCart = useCallback((shop, product) => {
    setCart({
      shopId: shop.id,
      shopName: shop.name,
      items: [{ productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }],
    })
  }, [])

  const setQuantity = useCallback((productId, quantity) => {
    setCart((c) => {
      const q = Math.max(0, Math.min(MAX_QTY, Math.floor(quantity)))
      const items =
        q === 0
          ? c.items.filter((i) => i.productId !== productId)
          : c.items.map((i) => (i.productId === productId ? { ...i, quantity: q } : i))
      return items.length ? { ...c, items } : EMPTY
    })
  }, [])

  const removeItem = useCallback((productId) => setQuantity(productId, 0), [setQuantity])
  const clearCart = useCallback(() => setCart(EMPTY), [])

  const value = useMemo(() => {
    const count = cart.items.reduce((n, i) => n + i.quantity, 0)
    const quantityOf = (productId) => cart.items.find((i) => i.productId === productId)?.quantity ?? 0
    return { cart, count, quantityOf, addItem, startNewCart, setQuantity, removeItem, clearCart }
  }, [cart, addItem, startNewCart, setQuantity, removeItem, clearCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
