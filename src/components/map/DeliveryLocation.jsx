import { lazy, Suspense } from 'react'
import { formatCoords, isValidCoords, navigationUrl } from '../../lib/geo'

const LocationMap = lazy(() => import('./LocationMap'))

/**
 * Shows a delivery location: address, coordinates, instructions, a map and (optionally)
 * a "Navigate to Customer" button. `location` is a row from order_locations, which the
 * database only returns to the customer, the assigned delivery boy and admins.
 */
export default function DeliveryLocation({ location, navigate = false, showMap = true, mapLabel = 'Delivery location map' }) {
  if (!location) return null
  const lat = location.latitude == null ? null : Number(location.latitude)
  const lng = location.longitude == null ? null : Number(location.longitude)
  const hasCoords = isValidCoords(lat, lng)

  return (
    <div className="delivery-location">
      <dl className="details">
        <div>
          <dt>Address</dt>
          <dd className="break">{location.address}</dd>
        </div>
        <div>
          <dt>Latitude</dt>
          <dd>{hasCoords ? lat.toFixed(6) : '—'}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{hasCoords ? lng.toFixed(6) : '—'}</dd>
        </div>
        {hasCoords && location.accuracy_m != null && location.location_source === 'gps' && (
          <div>
            <dt>GPS accuracy</dt>
            <dd>about {location.accuracy_m} m</dd>
          </div>
        )}
        {location.instructions && (
          <div>
            <dt>Instructions</dt>
            <dd className="break">{location.instructions}</dd>
          </div>
        )}
      </dl>

      {navigate && (
        <a
          className="btn btn-primary btn-block btn-lg navigate-btn"
          href={navigationUrl({ lat, lng, address: location.address })}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
          Navigate to Customer
        </a>
      )}

      {showMap &&
        (hasCoords ? (
          <Suspense fallback={<div className="location-map-wrap"><div className="map-overlay">Loading map…</div></div>}>
            <LocationMap lat={lat} lng={lng} label={mapLabel} />
          </Suspense>
        ) : (
          <p className="muted small">No map pin for this order (placed before GPS locations were added). Use the address.</p>
        ))}
      {hasCoords && <p className="muted small coords-line">Pin: {formatCoords(lat, lng)}</p>}
    </div>
  )
}

export const LOCATION_FIELDS = 'address, latitude, longitude, accuracy_m, location_source, instructions'
