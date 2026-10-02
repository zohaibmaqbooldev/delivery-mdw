/*
 * The full order flow as the admin sees it:
 *   Pending → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered
 * It combines orders.status (shop side) with orders.delivery_status (delivery side).
 */

export const FLOW = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
]

const TONES = {
  pending: 'warn',
  accepted: 'info',
  preparing: 'info',
  ready: 'warn',
  assigned: 'info',
  out_for_delivery: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

/** Where an order is in the flow: { key, label, tone }. */
export function orderStage(order) {
  if (order.status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', tone: 'danger' }
  let key = order.status
  if (order.status === 'ready') key = order.delivery_boy_id ? 'assigned' : 'ready'
  const step = FLOW.find((s) => s.key === key) ?? { key, label: key }
  return { ...step, tone: TONES[key] ?? 'neutral' }
}

/** Filters for the admin orders list; `apply` adds the matching conditions to a query. */
export const STAGE_FILTERS = [
  { key: 'all', label: 'All', apply: (q) => q },
  { key: 'pending', label: 'Pending', apply: (q) => q.eq('status', 'pending') },
  { key: 'kitchen', label: 'Accepted / Preparing', apply: (q) => q.in('status', ['accepted', 'preparing']) },
  { key: 'ready', label: 'Ready (no rider)', apply: (q) => q.eq('status', 'ready').is('delivery_boy_id', null) },
  { key: 'assigned', label: 'Assigned', apply: (q) => q.eq('status', 'ready').not('delivery_boy_id', 'is', null) },
  { key: 'out_for_delivery', label: 'Out for Delivery', apply: (q) => q.eq('status', 'out_for_delivery') },
  { key: 'delivered', label: 'Delivered', apply: (q) => q.eq('status', 'delivered') },
  { key: 'cancelled', label: 'Cancelled', apply: (q) => q.eq('status', 'cancelled') },
]

/** Can the admin (re)assign a delivery boy to this order right now? */
export function canAssign(order) {
  return order.status === 'ready' && ['not_assigned', 'assigned', 'accepted'].includes(order.delivery_status)
}
