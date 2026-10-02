import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCart } from '../../context/CartContext'
import { formatPrice, isUuid } from '../../lib/format'
import {
  EmptyState,
  ErrorState,
  ImageTile,
  OpenBadge,
  PageHeader,
  QuantityStepper,
  Skeleton,
} from '../../components/user/ui'

// Shop Details — /user/shops/:id
export default function ShopDetails() {
  const { id } = useParams()
  const { cart, count, quantityOf, addItem, startNewCart, setQuantity } = useCart()
  const [state, setState] = useState({ loading: true, error: '', shop: null, products: [] })
  const [conflict, setConflict] = useState(null) // { product, shopName }

  const load = useCallback(async () => {
    if (!isUuid(id)) return setState({ loading: false, error: '', shop: null, products: [] })
    setState((s) => ({ ...s, loading: true, error: '' }))
    const [shopRes, productRes] = await Promise.all([
      supabase
        .from('shops')
        .select('id, name, description, image_url, location, phone, delivery_fee, is_open')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('products')
        .select('id, name, description, price, image_url, is_available, categories(name, sort_order)')
        .eq('shop_id', id)
        .order('name'),
    ])
    const error = shopRes.error || productRes.error
    setState({
      loading: false,
      error: error ? error.message : '',
      shop: shopRes.data,
      products: productRes.data ?? [],
    })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const { loading, error, shop, products } = state

  if (loading) {
    return (
      <div className="container user-content">
        <Skeleton rows={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container user-content">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="container user-content">
        <EmptyState
          title="Shop not found"
          text="This shop doesn't exist or isn't available right now."
          action={
            <Link to="/user/shops" className="btn btn-primary">
              Browse shops
            </Link>
          }
        />
      </div>
    )
  }

  function handleAdd(product) {
    const res = addItem(shop, product)
    if (!res.ok) setConflict({ product, shopName: res.conflictShopName })
    else setConflict(null)
  }

  // Group products by category for easier scanning.
  const groups = []
  for (const p of products) {
    const name = p.categories?.name ?? 'Other'
    const sort = p.categories?.sort_order ?? 999
    let g = groups.find((x) => x.name === name)
    if (!g) groups.push((g = { name, sort, items: [] }))
    g.items.push(p)
  }
  groups.sort((a, b) => a.sort - b.sort)

  const cartIsThisShop = cart.shopId === shop.id && count > 0

  return (
    <div className="container user-content">
      <PageHeader title={shop.name} back={{ to: '/user/shops', label: 'All shops' }} />

      <section className="card shop-hero">
        <ImageTile src={shop.image_url} name={shop.name} className="shop-hero-img" />
        <div className="shop-hero-info">
          <OpenBadge isOpen={shop.is_open} />
          {shop.description && <p className="shop-desc">{shop.description}</p>}
          <dl className="shop-facts">
            <div>
              <dt>Location</dt>
              <dd>{shop.location || '—'}</dd>
            </div>
            {shop.phone && (
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${shop.phone}`}>{shop.phone}</a>
                </dd>
              </div>
            )}
            <div>
              <dt>Delivery fee</dt>
              <dd>{Number(shop.delivery_fee) > 0 ? formatPrice(shop.delivery_fee) : 'Free'}</dd>
            </div>
          </dl>
          {!shop.is_open && (
            <p className="alert alert-info">This shop is closed right now. You can browse, but ordering is paused.</p>
          )}
        </div>
      </section>

      {conflict && (
        <div className="alert alert-warn" role="alert">
          <p>
            Your cart already has items from <strong>{conflict.shopName}</strong>. Each order can only come from one
            shop.
          </p>
          <div className="row gap wrap">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                startNewCart(shop, conflict.product)
                setConflict(null)
              }}
            >
              Start a new cart
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConflict(null)}>
              Keep current cart
            </button>
          </div>
        </div>
      )}

      <section className="block">
        <h2 className="h2 block-title">Products</h2>
        {products.length === 0 ? (
          <EmptyState title="No products yet" text="This shop hasn't added any products." />
        ) : (
          groups.map((g) => (
            <div key={g.name} className="product-group">
              <h3 className="group-title">{g.name}</h3>
              <ul className="product-list">
                {g.items.map((p) => {
                  const qty = quantityOf(p.id)
                  const canBuy = shop.is_open && p.is_available
                  return (
                    <li key={p.id} className="card product-row">
                      <ImageTile src={p.image_url} name={p.name} className="product-row-img" />
                      <div className="product-row-info">
                        <span className="product-row-name">{p.name}</span>
                        {p.description && <span className="muted small">{p.description}</span>}
                        <span className="price">{formatPrice(p.price)}</span>
                      </div>
                      <div className="product-row-action">
                        {!p.is_available ? (
                          <span className="pill pill-neutral">Unavailable</span>
                        ) : qty > 0 && cart.shopId === shop.id ? (
                          <QuantityStepper value={qty} label={p.name} onChange={(v) => setQuantity(p.id, v)} />
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!canBuy}
                            onClick={() => handleAdd(p)}
                            aria-label={`Add ${p.name} to cart`}
                          >
                            {shop.is_open ? 'Add to Cart' : 'Closed'}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {cartIsThisShop && (
        <div className="cart-bar">
          <span>
            {count} {count === 1 ? 'item' : 'items'} in cart
          </span>
          <Link to="/user/cart" className="btn btn-primary btn-sm">
            View cart
          </Link>
        </div>
      )}
    </div>
  )
}
