import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CENTER, isValidCoords, round6 } from '../../lib/geo'
import { config } from '../../lib/config'

/*
 * Leaflet + OpenStreetMap map. Leaflet is loaded only when a map is shown, so pages
 * without maps don't download it.
 *
 * Props:
 *   lat, lng     marker position (optional; without it the map centres on DEFAULT_CENTER)
 *   editable     true: tap the map or drag the pin to move it (calls onChange)
 *   onChange     ({ lat, lng }) => void
 *   label        accessible label for the map
 */

const TILE_URL = config.mapTileUrl
const TILE_ATTRIBUTION = config.mapTileAttribution

let leafletPromise = null
function loadLeafletCss() {
  // Leaflet's stylesheet is a static file (public/vendor/leaflet), added only when a map is shown.
  if (document.querySelector('link[data-leaflet-css]')) return Promise.resolve()
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/vendor/leaflet/leaflet.css'
    link.dataset.leafletCss = ''
    link.onload = resolve
    link.onerror = resolve // the map still works; it just looks unstyled
    document.head.appendChild(link)
  })
}
function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = Promise.all([import('leaflet'), loadLeafletCss()]).then(([m]) => m.default ?? m)
  }
  return leafletPromise
}

function pinIcon(L) {
  return L.divIcon({
    className: 'map-pin',
    html: '<span class="map-pin-dot"></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  })
}

export default function LocationMap({ lat, lng, editable = false, onChange, label = 'Map', zoom = 16 }) {
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const leaflet = useRef(null)
  const onChangeRef = useRef(onChange)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [tilesFailed, setTilesFailed] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const has = isValidCoords(Number(lat), Number(lng))

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current) return
        leaflet.current = L
        const center = has ? [Number(lat), Number(lng)] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]
        const m = L.map(el.current, { center, zoom: has ? zoom : 12, scrollWheelZoom: false, tap: true })
        const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION })
        let errors = 0
        tiles.on('tileerror', () => {
          errors += 1
          if (errors >= 4) setTilesFailed(true)
        })
        tiles.on('tileload', () => setTilesFailed(false))
        tiles.addTo(m)
        if (editable) {
          m.on('click', (e) => onChangeRef.current?.({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }))
        }
        map.current = m
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
      // Stop any pan/zoom animation first: removing a map mid-animation makes Leaflet throw.
      map.current?.stop()
      map.current?.off()
      map.current?.remove()
      map.current = null
      marker.current = null
    }
    // The map is created once; position updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the marker in sync with lat/lng.
  useEffect(() => {
    const L = leaflet.current
    const m = map.current
    if (!L || !m) return
    if (!has) {
      marker.current?.remove()
      marker.current = null
      return
    }
    const pos = [Number(lat), Number(lng)]
    if (!marker.current) {
      marker.current = L.marker(pos, { icon: pinIcon(L), draggable: editable, keyboard: editable, title: 'Delivery location' }).addTo(m)
      if (editable) {
        marker.current.on('dragend', () => {
          const p = marker.current.getLatLng()
          onChangeRef.current?.({ lat: round6(p.lat), lng: round6(p.lng) })
        })
      }
      m.setView(pos, Math.max(m.getZoom(), zoom), { animate: false })
    } else {
      marker.current.setLatLng(pos)
      if (!m.getBounds().pad(-0.2).contains(pos)) m.panTo(pos)
    }
  }, [lat, lng, has, editable, zoom, status])

  return (
    <div className="location-map-wrap">
      <div ref={el} className="location-map" role="application" aria-label={label} />
      {status === 'loading' && <div className="map-overlay">Loading map…</div>}
      {status === 'error' && <div className="map-overlay">The map couldn't load. Your location is still saved as coordinates.</div>}
      {status === 'ready' && tilesFailed && (
        <div className="map-overlay map-overlay-note">Map images couldn't load. Check your connection; the pin position still works.</div>
      )}
    </div>
  )
}
