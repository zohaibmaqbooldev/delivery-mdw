/*
 * Location helpers: browser GPS, coordinate checks, navigation links.
 * The database validates coordinates again in place_order(); these checks are for
 * quick feedback in the browser only.
 */

import { config } from './config'

export const DEFAULT_CENTER = (() => {
  const raw = config.mapDefaultCenter // e.g. "31.5204,74.3587"
  const [lat, lng] = String(raw ?? '').split(',').map(Number)
  return isValidCoords(lat, lng) ? { lat, lng } : { lat: 31.5204, lng: 74.3587 } // Lahore
})()

export function isValidCoords(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

export function round6(n) {
  return Math.round(n * 1e6) / 1e6
}

export function formatCoords(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
}

/** Why a GPS request failed, in plain words. */
export const GEO_ERRORS = {
  unsupported: "Your browser can't share its location. Drop the pin on the map instead.",
  insecure: 'Location only works on a secure (https) page. Drop the pin on the map instead.',
  denied:
    'Location permission was blocked. Allow location for this site in your browser settings, or drop the pin on the map.',
  unavailable: "Your location couldn't be found right now. Check that GPS/location is on, or drop the pin on the map.",
  timeout: 'Finding your location took too long. Try again outside or near a window, or drop the pin on the map.',
  invalid: 'Your device returned an invalid location. Please drop the pin on the map.',
}

/** Resolves { lat, lng, accuracy } or rejects with an Error whose .code is a GEO_ERRORS key. */
export function getCurrentPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code) => {
      const e = new Error(GEO_ERRORS[code])
      e.code = code
      reject(e)
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) return fail('insecure')
    if (!('geolocation' in navigator)) return fail('unsupported')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        if (!isValidCoords(latitude, longitude)) return fail('invalid')
        resolve({ lat: round6(latitude), lng: round6(longitude), accuracy: Math.round(accuracy ?? 0) })
      },
      (err) => fail(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    )
  })
}

/** Turn-by-turn directions in Google Maps (opens the Maps app on phones). */
export function navigationUrl({ lat, lng, address }) {
  if (isValidCoords(Number(lat), Number(lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}&travelmode=driving`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address ?? '')}&travelmode=driving`
}

/** Search link for a plain address (used for shop pickup addresses). */
export function mapSearchUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? '')}`
}
