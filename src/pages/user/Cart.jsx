import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import useLiveCart from '../../lib/useLiveCart'
import { formatPrice } from '../../lib/format'
import { EmptyState, ErrorState, ImageTile, PageHeader, QuantityStepper, Skeleton } from '../../components/user/ui'

export function OrderTotals({ subtotal, deliveryFee, total }) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatPrice(subtotal)}</dd>
      </div>
      <div>
        <dt>Delivery fee</dt>
        <dd>{deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free'}</dd>
      </div>
      <div className="totals-grand">
        <dt>Total</dt>
        <dd>{formatPrice(total)}</dd>
      </div>
    </dl>
  )
}

// Cart — /user/cart
export default function Cart() {
  const { removeItem, setQuantity, clearCart } = useCart()
  const { cart, loading, error, reload, shop, lines, subtotal, deliveryFee, total, blockReason } = useLiveCart()

  if (cart.items.length === 0) {
    return (
      <div className="container user-content">
        <PageHeader title="Cart" />
        <EmptyState
          title="Your cart is empty"
          text="Add products from a shop to start an order."
          action={
            <Link to="/user/shops" className="btn btn-primary">
              Browse shops
            </Link>
          }
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container user-content">
        <PageHeader title="Cart" />
        <Skeleton rows={3} />
      </div>
    )
  }

  return (
    <div className="container user-content">
      <PageHeader title="Cart" subtitle={`From ${shop?.name ?? cart.shopName}`}>
        <button className="btn btn-ghost btn-sm" onClick={clearCart}>
          Clear cart
        </button>
      </PageHeader>

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="cart-layout">
        <section className="card">
          <h2 className="h3">Selected products</h2>
          <ul className="cart-list">
            {lines.map((l) => (
              <li key={l.productId} className={`cart-line ${l.available ? '' : 'is-unavailable'}`}>
                <ImageTile src={l.image_url} name={l.name} className="cart-line-img" />
                <div className="cart-line-info">
                  <span className="cart-line-name">{l.name}</span>
                  <span className="muted small">{formatPrice(l.price)} each</span>
                  {!l.available && <span className="pill pill-danger">No longer available</span>}
                  {l.available && l.priceChanged && <span className="pill pill-warn">Price updated</span>}
                </div>
                <div className="cart-line-controls">
                  {l.available && (
                    <QuantityStepper value={l.quantity} label={l.name} onChange={(v) => setQuantity(l.productId, v)} />
                  )}
                  <span className="cart-line-total">{l.available ? formatPrice(l.lineTotal) : '—'}</span>
                  <button className="link-btn danger" onClick={() => removeItem(l.productId)} aria-label={`Remove ${l.name}`}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Link to={`/user/shops/${cart.shopId}`} className="add-more">
            + Add more from {shop?.name ?? cart.shopName}
          </Link>
        </section>

        <section className="card checkout">
          <h2 className="h3">Order summary</h2>
          <OrderTotals subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
          <p className="muted small">Payment: cash on delivery.</p>
          {blockReason && <div className="alert alert-info">{blockReason}</div>}
          {blockReason ? (
            <button className="btn btn-primary btn-block btn-lg" type="button" disabled>
              Checkout
            </button>
          ) : (
            <Link to="/user/checkout" className="btn btn-primary btn-block btn-lg">
              Checkout · {formatPrice(total)}
            </Link>
          )}
        </section>
      </div>
    </div>
  )
}
