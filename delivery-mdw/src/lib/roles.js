export const ROLES = {
  admin: { label: 'Admin', path: '/admin' },
  user: { label: 'Customer', path: '/user' },
  shop: { label: 'Shop', path: '/shop' },
  delivery: { label: 'Delivery Boy', path: '/delivery' },
}

// Roles a visitor may pick on the signup page. Admins are promoted in the database.
export const SIGNUP_ROLES = ['user', 'shop', 'delivery']

export function dashboardPath(role) {
  return ROLES[role]?.path ?? '/'
}

export function roleLabel(role) {
  return ROLES[role]?.label ?? role
}
