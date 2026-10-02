const wholeFmt = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})
const centsFmt = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(value) {
  const n = Number(value ?? 0)
  return Number.isInteger(n) ? wholeFmt.format(n) : centsFmt.format(n)
}

export function formatDate(value, withTime = false) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function formatOrderNumber(n) {
  return `#${n}`
}

export const ORDER_STATUS = {
  pending: { label: 'Pending', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'info' },
  preparing: { label: 'Preparing', tone: 'info' },
  ready: { label: 'Ready for pickup', tone: 'info' },
  out_for_delivery: { label: 'Out for delivery', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const DELIVERY_STATUS = {
  not_assigned: { label: 'Waiting for a rider', tone: 'neutral' },
  assigned: { label: 'Rider assigned', tone: 'info' },
  accepted: { label: 'Rider accepted', tone: 'info' },
  picked_up: { label: 'Picked up', tone: 'info' },
  out_for_delivery: { label: 'Out for delivery', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v) => UUID_RE.test(v ?? '')

/** Make user input safe to use inside a PostgREST ilike/or filter. */
export function cleanSearch(term) {
  return (term ?? '').replace(/[,()*%\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}
