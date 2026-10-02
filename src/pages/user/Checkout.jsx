import { lazy, Suspense, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import useLiveCart from '../../lib/useLiveCart'
import { formatCoords, getCurrentPosition, isValidCoords } from '../../lib/geo'
import { formatPrice } from '../../lib/format'
import { ErrorState, PageHeader, Skeleton, friendlyError } from '../../components/user/ui'
import { OrderTotals } from './Cart'

const LocationMap = lazy(() => import('../../components/map/LocationMap'))

const PHONE_RE = /^[+0-9][0-9 -]{6,19}$/

function LocationPicker({ value, onChange, confirmed, onConfirm, onUnconfirm }) {
  const [gps, setGps] = useState({ state: 'idle', message: '' }) // idle | locating | ok | error

  async function locate() {
    setGps({ state: 'locating', message: '' })
    try {
      const pos = await getCurrentPosition()
      onChange({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, source: 'gps' })
      setGps({ state: 'ok', message: '' })
    } catch (err) {
      setGps({ state: 'error', message: err.message })
    }
  }

  const has = value && isValidCoords(value.lat, value.lng)

  if (confirmed && has) {
    return (
      <div className="location-confirmed">
        <div>
          <span className="strong d-block">✓ Delivery location confirmed</span>
          <span className="muted small">
            {formatCoords(value.lat, value.lng)}
            {value.source === 'gps' && value.accuracy ? ` · accurate to about ${value.accuracy} m` : ' · placed on map'}
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onUnconfirm}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="location-picker">
      <p className="muted small">
        Share your current location, then drag the pin (or tap the map) to your exact door. Your location is only shared with the
        delivery boy delivering this order.
      </p>
      <button type="button" className="btn btn-primary" onClick={locate} disabled={gps.state === 'locating'}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
        {gps.state === 'locating' ? 'Finding your location…' : has ? 'Use my current location again' : 'Use my current location'}
      </button>
      {gps.state === 'error' && (
        <div className="alert alert-warn" role="alert">
          {gps.message}
        </div>
      )}

      <Suspense fallback={<div className="location-map-wrap"><div className="map-overlay">Loading map…</div></div>}>
        <LocationMap
          lat={value?.lat}
          lng={value?.lng}
          editable
          label="Delivery location map. Tap to place the pin."
          onChange={(p) => onChange({ ...p, accuracy: null, source: 'map' })}
        />
      </Suspense>

      {has ? (
        <div className="location-actions">
          <span className="small">
            Pin: <strong>{formatCoords(value.lat, value.lng)}</strong>
            {value.source === 'gps' && value.accuracy ? ` (±${value.accuracy} m)` : ''}
          </span>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirm this location
          </button>
        </div>
      ) : (
        <p className="muted small">No location yet — use your current location or tap the map.</p>
      )}
    </div>
  )
}

// Checkout — /user/checkout
export default function Checkout() {
  const { profile } = useAuth()
  const { clearCart } = useCart()
  const navigate = useNavigate()
  const { cart, loading, error, reload, shop, availableLines, subtotal, deliveryFee, total, blockReason } = useLiveCart()

  const [location, setLocation] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [form, setForm] = useState({ address: '', phone: profile?.phone ?? '', instructions: '', notes: '' })
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState('')

  if (cart.items.length === 0 && !placing) return <Navigate to="/user/cart" replace />

  if (loading) {
    return (
      <div className="container user-content">
        <PageHeader title="Checkout" back={{ to: '/user/cart', label: 'Cart' }} />
        <Skeleton rows={4} />
      </div>
    )
  }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function placeOrder(e) {
    e.preventDefault()
    setPlaceError('')
    if (!confirmed || !location || !isValidCoords(location.lat, location.lng))
      return setPlaceError('Please confirm your delivery location on the map.')
    if (form.address.trim().length < 5) return setPlaceError('Please enter your full delivery address.')
    if (!PHONE_RE.test(form.phone.trim())) return setPlaceError('Please enter a valid contact phone number.')

    setPlacing(true)
    const { data: orderId, error: err } = await supabase.rpc('place_order', {
      p_shop_id: cart.shopId,
      p_items: availableLines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_delivery_address: form.address.trim(),
      p_contact_phone: form.phone.trim(),
      p_latitude: location.lat,
      p_longitude: location.lng,
      p_location_accuracy: location.accuracy ?? null,
      p_location_source: location.source,
      p_delivery_instructions: form.instructions.trim() || null,
      p_notes: form.notes.trim() || null,
    })
    if (err) {
      setPlacing(false)
      setPlaceError(err.message)
      reload() // prices, stock or opening hours may have changed
      return
    }
    clearCart()
    navigate(`/user/orders/${orderId}`, { replace: true, state: { justPlaced: true } })
  }

  return (
    <div className="container user-content">
      <PageHeader title="Checkout" subtitle={`Order from ${shop?.name ?? cart.shopName}`} back={{ to: '/user/cart', label: 'Cart' }} />
      {error && <ErrorState message={error} onRetry={reload} />}

      <form className="checkout-layout" onSubmit={placeOrder} noValidate>
        <div className="checkout-main">
          <section className="card">
            <h2 className="h3">1. Delivery location</h2>
            <LocationPicker
              value={location}
              onChange={(p) => {
                setLocation(p)
                setConfirmed(false)
              }}
              confirmed={confirmed}
              onConfirm={() => setConfirmed(true)}
              onUnconfirm={() => setConfirmed(false)}
            />
          </section>

          <section className="card">
            <h2 className="h3">2. Delivery details</h2>
            <div className="form">
              <label className="field">
                <span>Delivery address</span>
                <textarea
                  rows={3}
                  required
                  maxLength={300}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={update('address')}
                  placeholder="House / flat no., street, area, city"
                />
              </label>
              <label className="field">
                <span>Contact phone</span>
                <input type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} value={form.phone} onChange={update('phone')} />
              </label>
              <label className="field">
                <span>
                  Delivery instructions <span className="optional">(optional, for the delivery boy)</span>
                </span>
                <input maxLength={300} value={form.instructions} onChange={update('instructions')} placeholder="e.g. Blue gate, 2nd floor, call on arrival" />
              </label>
              <label className="field">
                <span>
                  Note for the shop <span className="optional">(optional)</span>
                </span>
                <input maxLength={300} value={form.notes} onChange={update('notes')} />
              </label>
            </div>
          </section>
        </div>

        <section className="card checkout checkout-side">
          <h2 className="h3">Order summary</h2>
          <ul className="checkout-items">
            {availableLines.map((l) => (
              <li key={l.productId}>
                <span>
                  {l.quantity}× {l.name}
                </span>
                <span>{formatPrice(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
          <p className="muted small">Payment: cash on delivery.</p>
          {blockReason && (
            <div className="alert alert-info">
              {blockReason} <Link to="/user/cart">Back to cart</Link>
            </div>
          )}
          {!confirmed && !blockReason && <p className="muted small">Confirm your delivery location to place the order.</p>}
          {placeError && (
            <div className="alert alert-error" role="alert">
              {friendlyError(placeError)}
            </div>
          )}
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={placing || Boolean(blockReason) || !confirmed}>
            {placing ? 'Placing order…' : `Place Order · ${formatPrice(total)}`}
          </button>
        </section>
      </form>
    </div>
  )
}
