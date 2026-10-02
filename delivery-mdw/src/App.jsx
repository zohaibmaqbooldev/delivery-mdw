import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { DashboardRedirect, ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import NotFound from './pages/NotFound'

// Each role's area is loaded only when it's first opened, so customers don't download
// admin code (and vice versa).
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const UserLayout = lazy(() => import('./components/user/UserLayout'))
const UserDashboard = lazy(() => import('./pages/dashboards/UserDashboard'))
const Shops = lazy(() => import('./pages/user/Shops'))
const ShopDetails = lazy(() => import('./pages/user/ShopDetails'))
const Cart = lazy(() => import('./pages/user/Cart'))
const Checkout = lazy(() => import('./pages/user/Checkout'))
const Orders = lazy(() => import('./pages/user/Orders'))
const OrderDetails = lazy(() => import('./pages/user/OrderDetails'))
const Profile = lazy(() => import('./pages/user/Profile'))

const ShopLayout = lazy(() => import('./components/shop/ShopLayout'))
const ShopDashboard = lazy(() => import('./pages/dashboards/ShopDashboard'))
const ShopProfile = lazy(() => import('./pages/shop/ShopProfile'))
const ShopProducts = lazy(() => import('./pages/shop/Products'))
const AddProduct = lazy(() => import('./pages/shop/AddProduct'))
const EditProduct = lazy(() => import('./pages/shop/EditProduct'))
const ShopOrders = lazy(() => import('./pages/shop/ShopOrders'))
const ShopOrderDetails = lazy(() => import('./pages/shop/ShopOrderDetails'))

const DeliveryLayout = lazy(() => import('./components/delivery/DeliveryLayout'))
const DeliveryDashboard = lazy(() => import('./pages/dashboards/DeliveryDashboard'))
const Deliveries = lazy(() => import('./pages/delivery/Deliveries'))
const DeliveryDetails = lazy(() => import('./pages/delivery/DeliveryDetails'))
const DeliveryProfile = lazy(() => import('./pages/delivery/DeliveryProfile'))

const AdminLayout = lazy(() => import('./components/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminUserDetails = lazy(() => import('./pages/admin/UserDetails'))
const AdminShops = lazy(() => import('./pages/admin/Shops'))
const AdminShopDetails = lazy(() => import('./pages/admin/ShopDetails'))
const AdminDeliveryBoys = lazy(() => import('./pages/admin/DeliveryBoys'))
const AdminDeliveryBoyDetails = lazy(() => import('./pages/admin/DeliveryBoyDetails'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminOrderDetails = lazy(() => import('./pages/admin/OrderDetails'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminProductDetails = lazy(() => import('./pages/admin/ProductDetails'))
const AdminCategories = lazy(() => import('./pages/admin/Categories'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>
        {/* Opened from the password-reset email; that link signs the user in. */}
        <Route path="reset-password" element={<ResetPassword />} />

        <Route path="dashboard" element={<DashboardRedirect />} />

        <Route element={<ProtectedRoute allow={['admin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetails />} />
            <Route path="shops" element={<AdminShops />} />
            <Route path="shops/:id" element={<AdminShopDetails />} />
            <Route path="delivery" element={<AdminDeliveryBoys />} />
            <Route path="delivery/:id" element={<AdminDeliveryBoyDetails />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetails />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductDetails />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={['user']} />}>
          <Route path="user" element={<UserLayout />}>
            <Route index element={<UserDashboard />} />
            <Route path="shops" element={<Shops />} />
            <Route path="shops/:id" element={<ShopDetails />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={['shop']} />}>
          <Route path="shop" element={<ShopLayout />}>
            <Route index element={<ShopDashboard />} />
            <Route path="profile" element={<ShopProfile />} />
            <Route path="products" element={<ShopProducts />} />
            <Route path="products/add" element={<AddProduct />} />
            <Route path="products/:id/edit" element={<EditProduct />} />
            <Route path="orders" element={<ShopOrders />} />
            <Route path="orders/:id" element={<ShopOrderDetails />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={['delivery']} />}>
          <Route path="delivery" element={<DeliveryLayout />}>
            <Route index element={<DeliveryDashboard />} />
            <Route path="orders" element={<Deliveries />} />
            <Route path="orders/:id" element={<DeliveryDetails />} />
            <Route path="profile" element={<DeliveryProfile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
