import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useCart } from '../context/CartContext'

/**
 * The cart with current prices/availability from the database (they may have changed
 * since the items were added). Shared by the Cart and Checkout pages. The database
 * recalculates everything again when the order is placed.
 */
export default function useLiveCart() {
  const { cart } = useCart()
  const [live, setLive] = useState({ loading: true, error: '', shop: null, products: {} })
  const ids = cart.items.map((i) => i.productId).join(',')

  const reload = useCallback(async () => {
    if (!cart.shopId || !ids) return setLive({ loading: false, error: '', shop: null, products: {} })
    const [shopRes, prodRes] = await Promise.all([
      supabase.from('shops').select('id, name, is_open, delivery_fee').eq('id', cart.shopId).eq('is_active', true).maybeSingle(),
      supabase.from('products').select('id, name, price, image_url, is_available').eq('shop_id', cart.shopId).in('id', ids.split(',')),
    ])
    const error = shopRes.error || prodRes.error
    setLive({
      loading: false,
      error: error ? error.message : '',
      shop: shopRes.data,
      products: Object.fromEntries((prodRes.data ?? []).map((p) => [p.id, p])),
    })
    // `ids` captures which products are in the cart; quantity changes don't need a refetch.
  }, [cart.shopId, ids])

  useEffect(() => {
    reload()
  }, [reload])

  const summary = useMemo(() => {
    const shop = live.shop
    const lines = cart.items.map((item) => {
      const p = live.products[item.productId]
      const price = p ? Number(p.price) : item.price
      return {
        ...item,
        name: p?.name ?? item.name,
        image_url: p?.image_url,
        price,
        available: Boolean(p && p.is_available),
        priceChanged: p ? Number(p.price) !== item.price : false,
        lineTotal: price * item.quantity,
      }
    })
    const availableLines = lines.filter((l) => l.available)
    const subtotal = availableLines.reduce((s, l) => s + l.lineTotal, 0)
    const deliveryFee = shop ? Number(shop.delivery_fee) : 0
    let blockReason = ''
    if (!shop) blockReason = 'This shop is no longer available. Clear your cart to start again.'
    else if (!shop.is_open) blockReason = `${shop.name} is closed right now. You can place the order once it opens.`
    else if (lines.some((l) => !l.available)) blockReason = 'Remove unavailable items before placing your order.'
    return { shop, lines, availableLines, subtotal, deliveryFee, total: subtotal + deliveryFee, blockReason }
  }, [cart.items, live.shop, live.products])

  return { cart, loading: live.loading, error: live.error, reload, ...summary }
}
