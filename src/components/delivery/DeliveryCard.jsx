import { Link } from 'react-router-dom'
import { formatOrderNumber, formatPrice } from '../../lib/format'
import { DeliveryStatusBadge } from '../user/ui'

/** One delivery in a list: who, where, from which shop, how much, and status. */
export default function DeliveryCard({ order }) {
  // The address comes from order_locations, which the database only reveals
  // while this delivery boy is actively delivering the order.
  const address = order.location?.address
  return (
    <li className="card delivery-card">
      <div className="delivery-card-top">
        <span className="order-number">Order {formatOrderNumber(order.order_number)}</span>
        <DeliveryStatusBadge status={order.delivery_status} />
      </div>
      <dl className="delivery-facts">
        <div>
          <dt>Customer</dt>
          <dd>{order.customer_name || 'Customer'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            <a href={`tel:${order.contact_phone}`}>{order.contact_phone}</a>
          </dd>
        </div>
        <div className="span-2">
          <dt>Deliver to</dt>
          <dd className="break">{address ?? <span className="muted">Hidden after delivery</span>}</dd>
        </div>
        <div>
          <dt>Shop</dt>
          <dd>{order.shop_name}</dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd className="strong">{formatPrice(order.total)}</dd>
        </div>
      </dl>
      <Link to={`/delivery/orders/${order.id}`} className="btn btn-outline btn-sm btn-block">
        View delivery
      </Link>
    </li>
  )
}

export const DELIVERY_LIST_FIELDS =
  'id, order_number, customer_name, contact_phone, shop_name, total, delivery_status, assigned_at, delivered_at, location:order_locations(address)'
