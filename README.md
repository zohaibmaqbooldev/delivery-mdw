# Delivery MDW

A responsive React + Supabase web app with four roles — **Admin**, **User**, **Shop** and **Delivery Boy** — each with its own protected dashboard.

Built so far:

- **Step 1 — foundation:** landing page, signup, login, logout, role-based redirects, protected routes, and profiles secured with Row Level Security.
- **Step 2 — customer side:** home, shops, shop details, cart, placing orders, order history, order details and profile.
- **Step 3 — shop side:** dashboard, shop profile (with image and open/close), products (add, edit, delete, images), incoming orders and the Pending → Accepted → Preparing → Ready flow.
- **Step 4 — delivery boy side:** dashboard with online/offline, My Deliveries, delivery details with the Assigned → Accepted → Picked Up → Out for Delivery → Delivered flow, and a profile with photo and vehicle.
- **Step 5 — admin side:** dashboard, users, shops (approve/disable), delivery boys, all orders with manual delivery assignment, products (disable), categories, and profile, with a sidebar that becomes a menu on phones.
- **Production pass:** GPS delivery location at checkout (map pin you can adjust and confirm), delivery location + **Navigate to Customer** for the delivery boy, private location storage, **admin approval for new delivery boys**, password reset, friendly errors, server-side validation and abuse limits, image compression, and a static Vercel deployment with security headers.

## Stack

- React 19 + Vite 8
- React Router 7
- Supabase Auth and Supabase PostgreSQL (`@supabase/supabase-js`)
- Plain CSS (mobile-first, with light and dark themes)
- Leaflet + OpenStreetMap for maps (loaded only on pages that show a map)

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run these files in order: paste each one in and click **Run**.
   - `supabase/migrations/0001_profiles.sql`
   - `supabase/migrations/0002_customer.sql`
   - `supabase/migrations/0003_shop.sql` (this also creates the `shop-images` storage bucket)
   - `supabase/migrations/0004_delivery_statuses.sql`: **run this one on its own**, then:
   - `supabase/migrations/0005_delivery.sql` (this also creates the `avatars` storage bucket)
   - `supabase/migrations/0006_admin.sql`
   - `supabase/migrations/0007_integrity.sql` (safety checks that keep order data consistent, plus tidier permissions)
   - `supabase/migrations/0008_production.sql` (private delivery locations, delivery-boy approval, new `place_order`, input limits, abuse limits)

   All of them are safe to run more than once. 0004 has to be its own run because Postgres can't use new status values in the same run that adds them.
3. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (change it to your real domain when you deploy)
   - **Redirect URLs**: add `http://localhost:5173/**` (and later `https://<your-domain>/**`). Password-reset links return to `/reset-password`, so it must be allowed here.
4. Recommended **Authentication** settings for production:
   - **Providers → Email**: keep *Confirm email* on; set *Minimum password length* to **8**.
   - **Rate Limits**: keep the defaults (or lower) for sign-ups, sign-ins, and emails sent. These, and not the browser, are what stop password guessing.
   - **Attack Protection**: turn on CAPTCHA (hCaptcha/Turnstile) if you see abuse, and *Leaked password protection* on paid plans.
   - **SMTP Settings**: use your own SMTP provider. Supabase's built-in mailer only sends a few emails per hour, which is not enough for real sign-ups and password resets.

### 2. Configure the app

```bash
cp .env.example .env        # on Windows: copy .env.example .env
```

Fill in `.env` from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
```

Never put the `service_role` / secret key in this file.

### 3. Run it

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

### 4. Deploy to Vercel (static build + environment variables)

The repository ships a ready production build in `dist/`. `vercel.json` tells Vercel to **serve `dist/` as static files**: no install command, no build command, no npm or Vite on Vercel. The Supabase settings come from **Vercel Environment Variables**, not from files in the repository.

1. Push the repository to GitHub and import it in Vercel (Framework preset: **Other**; leave Build/Install/Output settings alone, `vercel.json` sets them).
2. In Vercel → Project → **Settings → Environment Variables**, add for **Production** (and Preview if you use preview links):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` (Supabase → Project Settings → API → Project URL) |
   | `SUPABASE_ANON_KEY` | the **anon / publishable** key (same page). **Never** the `service_role` / secret key. |
   | `MAP_DEFAULT_CENTER` | optional, e.g. `31.5204,74.3587` (where the map opens before GPS) |
   | `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION` | optional, only if you use a paid map tile provider |

3. **Redeploy** (Deployments → ⋯ → Redeploy). Environment variables apply to new deployments only.
4. In Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-app>.vercel.app` (or your custom domain)
   - **Redirect URLs**: add `https://<your-app>.vercel.app/**` (and your custom domain `/**`; for Vercel preview links, `https://*-<your-vercel-team>.vercel.app/**`). Keep `http://localhost:5173/**` only if you still develop locally.

   The app always sends people back to the domain they are on (`/login` after confirming an email, `/reset-password` after a reset email), so nothing else has to change when the domain changes; the domain just has to be in this list.

How the settings reach the browser: `index.html` loads `/env-config.js`, which Vercel routes to the small function `api/env-config.js`. It reads the two environment variables and returns only the public values. If a `service_role` / `sb_secret_` key is configured by mistake, the function **withholds it** and the app shows a "Wrong Supabase key" screen. Missing variables show a "Supabase is not configured" screen.

`vercel.json` also:
- sends every app route (e.g. `/user/orders/…` after a refresh) to `index.html`, while missing files under `/assets` still return 404;
- sets security headers: a strict **Content-Security-Policy** (scripts only from the site itself; data only from `*.supabase.co`; map images only from OpenStreetMap), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (location only for this site) and HSTS;
- caches hashed files in `/assets` for a year, and never caches pages or `/env-config.js`, so updates and key changes apply immediately.

If you use a custom Supabase domain or a different map tile server, add it to `img-src`/`connect-src` in the CSP in `vercel.json`.

**Rebuilding `dist/` after code changes** (on your computer, not on Vercel): `npm install && npm run build`, then commit `dist/`. For local development, `npm run dev` reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env`.

**Other static hosts** (no functions): create `dist/env-config.js` yourself containing `window.__MDW_CONFIG__ = { SUPABASE_URL: '…', SUPABASE_ANON_KEY: '…' }` with the public values only.

### 5. Create your first admin

Admin can't be chosen on the signup page, on purpose. Sign up normally, then run this in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Log out and back in, and you'll land on `/admin`. From then on, new shops appear under **Shops → Awaiting approval** for you to approve.

### 6. Approve delivery boys

New delivery boy accounts start **awaiting approval**. Until an admin approves them they can't go online, can't be assigned, and the database returns **no orders, order items, shop details or customer locations** to them. Approve them in **Admin → Delivery Boys → Awaiting approval → (name) → Approve delivery boy**. Revoking approval takes them offline and hands deliveries they haven't picked up yet to someone else (it's refused while they are carrying an order). Delivery boys who existed before 0008 were approved automatically so nothing stops working.

### 7. (Optional) Demo shops

Shop accounts now set up their own shop and products from `/shop/profile` and `/shop/products`. If you'd rather start with sample data, you can still load demo shops:

1. In the app, sign up 1–4 accounts with the **Shop** account type.
2. Run `supabase/seed/demo_shops.sql` in the SQL Editor.

Each shop account gets a demo shop with products. One of the demo shops, Golden Crust Bakery, starts closed. The seed creates **no orders**; orders only come from customers placing them. To remove the demo shops later:

```sql
delete from public.shops where description like '[demo]%';
```

## How it works

### Routes

| Route        | Who can open it                                              |
|--------------|--------------------------------------------------------------|
| `/`          | Everyone                                                     |
| `/login`     | Signed-out visitors (signed-in users go to their dashboard)  |
| `/signup`    | Signed-out visitors (signed-in users go to their dashboard)  |
| `/dashboard` | Signed-in users; it sends them to their role's dashboard     |
| `/admin`     | `admin` only                                                 |
| `/user`, `/user/shops`, `/user/shops/:id`, `/user/cart`, `/user/orders`, `/user/orders/:id`, `/user/profile` | `user` only |
| `/shop`      | `shop` only                                                  |
| `/shop`, `/shop/profile`, `/shop/products`, `/shop/products/add`, `/shop/products/:id/edit`, `/shop/orders`, `/shop/orders/:id` | `shop` only |
| `/delivery`, `/delivery/orders`, `/delivery/orders/:id`, `/delivery/profile` | `delivery` only |
| `/admin`, `/admin/users(/:id)`, `/admin/shops(/:id)`, `/admin/delivery(/:id)`, `/admin/orders(/:id)`, `/admin/products(/:id)`, `/admin/categories`, `/admin/profile` | `admin` only |

- A signed-out visitor who opens a dashboard is sent to `/login`.
- A signed-in user who opens another role's dashboard is sent to their own.

### Roles and profiles

- `public.profiles` holds `id, name, email, phone, role, created_at`. `role` is an enum: `admin | user | shop | delivery`.
- A database trigger creates the profile when someone signs up, using the name, phone and role from the signup form.
- Only `user`, `shop` and `delivery` can be chosen at signup. If anything else is sent, including `admin`, the account is saved as `user`.
- The app reads the role from `profiles`, not from `user_metadata`, which users can edit themselves.

### Row Level Security

- Signed-out visitors (`anon`) can't access `profiles` at all.
- Signed-in users can read only their own profile. Admins can read every profile.
- Users can update only their own `name` and `phone`. `role`, `email`, `id` and `created_at` can't be changed from the client.
- Nobody can insert or delete profiles from the client. Profiles are created by the trigger and removed when the auth user is deleted.

### Customer side

- **Cart:** saved in the browser for each signed-in user, so it survives a reload. It holds products from one shop at a time, because each order goes to one shop. Adding a product from a different shop asks before replacing the cart.
- **Placing an order:** handled by the `place_order()` database function. The database always works out prices, the delivery fee and the total, so a tampered browser can't change them. It rejects orders from closed or inactive shops, unavailable products, products from another shop, quantities outside 1–99, and any account that isn't a customer. The whole order is saved together, or not at all.
- **Payment:** cash on delivery. No online payment yet.
- **Statuses:** `status` goes pending → accepted → preparing → ready → out_for_delivery → delivered (or cancelled). `delivery_status` goes not_assigned → assigned → picked_up → delivered. For now, statuses only change from the database. The Shop and Delivery dashboards will update them later. The order page refreshes when you come back to the tab, and has a Refresh button.
- **Popular products:** ranked by units ordered across all customers, not counting cancelled orders. The `popular_products()` function shares only product and shop info, never who ordered.
- **Currency:** Pakistani rupees. Change it in `src/lib/format.js`.

### Row Level Security for the customer side

| Table         | Customers can…                                                          |
|---------------|-------------------------------------------------------------------------|
| `categories`  | read                                                                   |
| `shops`       | read active shops                                                      |
| `products`    | read products of active shops                                          |
| `orders`      | read **only their own** orders (create only through `place_order()`)  |
| `order_items` | read items of **only their own** orders                                 |

Signed-out visitors can't read any of these tables. Customers can't write to them directly, so they can't edit orders, prices or products.

### Shop side

- **Setting up:** a new shop account first creates its shop (name, phone, address, image, delivery fee, open or closed) on `/shop/profile`. Until it does, the other shop pages show a "Set up your shop" prompt. Each account can have one shop.
- **Open or closed:** customers can browse a closed shop but can't order from it.
- **Products:** name, description, price, optional category, image and available/unavailable. Unavailable products show to customers as "Unavailable" and can't be ordered. Deleting a product doesn't touch past orders, which keep their own copy of the name and price.
- **Images:** stored in the `shop-images` Supabase Storage bucket as JPG, PNG or WebP, up to 2 MB. Anyone with the URL can view them. Each shop can only upload to, replace or delete from its own folder (`<owner user id>/…`). Replaced and removed images are deleted from storage.
- **Order flow:** `shop_update_order_status()` only allows these steps, and only on the shop's own orders:
  - pending → accepted, or rejected (saved as `cancelled`)
  - accepted → preparing, or cancelled
  - preparing → ready

  Once an order is **ready**, it waits for a delivery boy. That's the next step to build.
- **Dashboard numbers:** *Completed* counts orders that are ready, out for delivery or delivered. *Total sales* is the sum of those orders' totals, including the delivery fee.
- **Customer name:** orders now keep a copy of the customer's name, so shops never need to read customer profiles.

### Row Level Security for the shop side

| Data               | A shop account can…                                                                          |
|--------------------|----------------------------------------------------------------------------------------------|
| `shops`            | read and update **only its own** shop (not `is_active`, which is for admins); create one shop |
| `products`         | read, add, edit and delete **only its own** products                                         |
| `orders`           | read **only orders placed with its shop**; change status only through `shop_update_order_status()` |
| `order_items`      | read items of **only its own** orders                                                        |
| `storage.objects`  | upload, replace and delete files **only in its own folder** of `shop-images`                 |

Shop accounts can't see other shops, other shops' products or `popular_products()`. Customers still see every active shop.

### Delivery boy side

- **How orders reach a delivery boy:** there's no admin dashboard yet, so assignment is automatic. When a shop marks an order **Ready**, the database assigns it to an **online** delivery boy with the fewest active deliveries, up to 3 each. If nobody is online, the order waits and is assigned as soon as someone goes online or finishes a delivery.
- **Going offline:** a delivery boy who goes offline hands back orders he hasn't accepted yet, and they go to someone else. Orders he has already accepted stay with him.
- **Flow:** `delivery_update_status()` allows only the next step, and only on the delivery boy's own orders:

  | Delivery status  | Button           | Order status becomes |
  |------------------|------------------|----------------------|
  | assigned         | Accept Delivery  | (still ready)        |
  | accepted         | Picked Up        | (still ready)        |
  | picked_up        | Out for Delivery | out_for_delivery     |
  | out_for_delivery | Delivered        | delivered            |

  **Delivered** asks him to confirm he collected the cash, then saves `delivered_at`. Customers and shops see each change on their order pages.
- **Dashboard numbers:**
  - *Assigned orders:* waiting for him to accept.
  - *Pending deliveries:* accepted but not yet delivered.
  - *Completed deliveries:* all time.
  - *Today's deliveries* and *Today's earnings:* use his own time zone. Earnings are the delivery fees of the orders he delivered today.
- **Refreshing:** the pages check for new assignments every 30 seconds while open, and when the tab becomes active again.
- **Profile:** name and phone (from `profiles`), email (read-only), photo, vehicle type and number, and online/offline. The photo is stored in the `avatars` bucket. Details live in a new one-per-account table, `delivery_riders`, created automatically on first visit.
- **Database changes:**
  - Two new `delivery_status` values: `accepted` and `out_for_delivery`.
  - Two new `orders` columns: `assigned_at` and `delivered_at`.
  - The `delivery_riders` table.

  No other tables or columns changed.

### Row Level Security for the delivery side

| Data               | A delivery boy can…                                                                   |
|--------------------|---------------------------------------------------------------------------------------|
| `orders`           | read **only orders assigned to him**; change them only through `delivery_update_status()` |
| `order_items`      | read items of **only his** orders                                                     |
| `shops`            | read a shop **only while he has an order from it** (for the pickup address and phone) |
| `delivery_riders`  | read and update **only his own** row (not the assignment bookkeeping)                 |
| `storage.objects`  | upload, replace and delete **only in his own folder** of `avatars`                    |

He can't read products, other profiles, other delivery boys' rows or orders, or any admin data. Customer contact details reach him only through the orders assigned to him. Shops and customers can't read `delivery_riders`.

### Admin side

- **Dashboard:**
  - Totals for users (customer accounts), shops (with how many are awaiting approval), delivery boys and orders.
  - Pending orders, completed orders (delivered), total sales (sum of delivered orders) and the 8 most recent orders.
  - Each card links to the matching filtered list.
- **Users:** search by name, email or phone; filter by role or deactivated; view details. You can deactivate or activate any account except your own.
  - A deactivated account sees "Your account is deactivated" on every page.
  - The database refuses its orders, shop actions and delivery actions.
  - Deactivating a shop account also closes its shop.
  - Deactivating a delivery boy takes him offline and hands his unaccepted deliveries to someone else.
- **Shops:** search, filter (awaiting approval, approved, disabled) and view details (owner, products, recent orders).
  - **Approval:** new shops start **unapproved** and customers can't see them until you approve. Shops that existed before migration 0006 are already approved.
  - **Disable:** hides a shop from customers without affecting past orders.
  - The shop owner sees a notice while waiting for approval or while disabled.
- **Delivery boys:** search, filter (online, deactivated), view profile, vehicle, online status and every assigned delivery; activate or deactivate.
- **Orders:** every order, with search (by order number, customer or shop) and stage filters.
  - Stages follow the full flow: Pending → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered (or Cancelled).
  - **Order details:** customer, shop, delivery boy, products, total, both statuses and a flow timeline.
- **Assigning a delivery boy:** once an order is **Ready**, you can assign (or re-assign) any active delivery boy until he has picked it up. Automatic assignment still runs as before; manual assignment overrides it.
- **Products:** search, filter (disabled, unavailable), view details including units ordered, and **disable/enable**. A disabled product is hidden from customers and can't be ordered, and the shop can't turn it back on.
- **Categories:** add, rename, reorder and delete. Deleting a category keeps its products for sale, just without a category.
- **Profile:** name, email (read-only), phone, profile image (in the `avatars` bucket), and Log out.
- **Sidebar:** on phones it becomes an **Admin menu** drawer. Esc or tapping outside closes it, and it closes by itself when you pick a page.

### Row Level Security for the admin side

- **Admin checks:** everything admin-only goes through `is_admin()`. That requires both the `admin` role **and** an active account.
- **Admin actions:** changing activation, approval, product disabling and delivery assignment are `admin_*` database functions. Each one refuses non-admins, so a shop can't approve itself and a delivery boy can't assign himself orders.
- **Categories:** only admins can insert, update or delete them.
- **Orders:** admins can read all orders and order items. Nobody else's access changed.
- **Database changes (0006):** new columns only, no new tables:
  - `profiles.is_active`
  - `profiles.avatar_url`
  - `shops.is_approved`
  - `products.is_disabled`

### Data integrity (0007)

- **Order status and delivery status must always agree.** The database enforces:
  - A delivery boy is set exactly when a delivery has started.
  - Delivery only starts once the order is ready.
  - "Out for delivery" and "delivered" match on both statuses.
  - Every delivered order has `delivered_at`.
- **Orders always keep the customer's name.**
- **`profiles.email` stays in sync** if someone changes their email in Supabase Auth.
- **Tighter permissions:** signed-out visitors can't call any helper or trigger function.
- **Speed:** a missing index on `order_items.product_id` is added.

### Delivery location and privacy (0008)

- **Checkout** (`/user/checkout`): the customer taps **Use my current location** (the browser asks for permission; HTTPS is required), sees the pin on a map, can drag it or tap the map to correct it, and must **Confirm this location** before **Place Order** is enabled. They also enter the full address, contact phone, delivery instructions and a note for the shop.
- The location (address, latitude, longitude, GPS accuracy, instructions) is stored in its own table, **`order_locations`**, not in `orders`. Its RLS allows reading only by: the customer who placed the order, the **approved** delivery boy assigned to it **while the delivery is in progress** (it disappears for him after delivery), and admins. The **shop never sees** the address or coordinates, only the customer's name, phone and note. Nobody can write to the table directly; only `place_order` creates rows, and nobody can edit them afterwards.
- Coordinates are never put in the app's URLs. The only place they appear in a link is the **Navigate to Customer** button (Google Maps directions to the exact pin), which only the assigned delivery boy sees.
- Orders created before 0008 keep their typed address (moved into `order_locations`) without a map pin; the delivery boy sees the address and a note instead of a map.

**Maps:** OpenStreetMap's public tiles are fine for low traffic but have a [usage policy](https://operations.osmfoundation.org/policies/tiles/). For heavier use, set `MAP_TILE_URL` to a tile provider you have an account with (and add its host to the CSP).

### Validation and abuse protection (0008)

Everything is enforced in the database, not only in the browser:
- `place_order` reads prices and the delivery fee from the database (anything the browser sends as a price is ignored), and checks quantities (1–99), no duplicate lines, a valid phone, address length, and coordinates (both present, in range, not 0,0).
- A customer can place at most **5 orders in 10 minutes** and have at most **5 orders waiting** for shops.
- Length and format limits on names, phones, descriptions, notes and fees; image URLs must point into the uploader's own storage folder.
- Sign-up can only choose customer / shop / delivery boy; asking for any other role gives a customer account.
- Images: JPG, PNG or WebP up to 10 MB are accepted and re-encoded in the browser (max 1200 px, WebP) before upload; the storage buckets still only accept images up to 2 MB in the uploader's own folder.
- Error messages from Supabase are translated into plain language; technical details are never shown.

### Password reset and sessions

**Forgot password?** on the login page sends a reset link (the same message is shown whether or not the email has an account). The link opens `/reset-password`, where the new password is set; a used or expired link shows "Link expired or already used". If a session expires or is revoked, the next request signs the user out and sends them to the login page.

### Email confirmation

Supabase turns on "Confirm email" by default. If it's on, signup shows a "Check your email" screen, and the link in the email signs the user in and opens their dashboard. If you turn it off (**Authentication → Sign In / Providers → Email**), new users go straight to their dashboard.

Supabase's built-in email service has a low hourly limit. Before real users sign up, set up custom SMTP.

## Project structure

```
src/
  main.jsx                  app entry (shows a setup screen if .env is missing)
  App.jsx                   route table
  styles.css
  lib/supabase.js           Supabase client
  lib/roles.js              role labels and dashboard paths
  context/AuthContext.jsx   session + profile (role) state, signOut
  components/
    RouteGuards.jsx         ProtectedRoute, PublicOnlyRoute, DashboardRedirect
    Navbar.jsx              responsive nav with mobile menu
    Layout.jsx, DashboardShell.jsx, LoadingScreen.jsx, ProfileProblem.jsx
    user/UserLayout.jsx     customer tabs (bottom bar on phones) + cart provider
    user/ui.jsx             shop card, badges, stepper, empty/error states
  context/CartContext.jsx   one-shop cart, saved per user
  lib/format.js             prices, dates, status labels
  pages/
    Landing.jsx, Login.jsx, Signup.jsx, NotFound.jsx, SetupRequired.jsx
    dashboards/UserDashboard.jsx   customer home (/user)
    dashboards/AdminDashboard.jsx, ShopDashboard.jsx, DeliveryDashboard.jsx
    dashboards/ShopDashboard.jsx   shop dashboard (/shop)
    user/Shops.jsx, ShopDetails.jsx, Cart.jsx, Orders.jsx, OrderDetails.jsx, Profile.jsx
    shop/ShopProfile.jsx, Products.jsx, AddProduct.jsx, EditProduct.jsx, ShopOrders.jsx, ShopOrderDetails.jsx
  components/shop/          ShopLayout (tabs + "set up shop" guard), ProductForm, ImagePicker
  context/MyShopContext.jsx the signed-in shop account's own shop
  lib/images.js             image checks, upload and removal
  lib/usePolling.js         periodic refresh while the tab is visible
  context/RiderContext.jsx  the signed-in delivery boy's details + online/offline
  components/delivery/      DeliveryLayout (tabs, online toggle), DeliveryCard
    dashboards/DeliveryDashboard.jsx  delivery dashboard (/delivery)
    delivery/Deliveries.jsx, DeliveryDetails.jsx, DeliveryProfile.jsx
    dashboards/AdminDashboard.jsx     admin dashboard (/admin)
    admin/Users, UserDetails, Shops, ShopDetails, DeliveryBoys, DeliveryBoyDetails,
          Orders, OrderDetails, Products, ProductDetails, Categories, AdminProfile
  components/admin/         AdminLayout (sidebar + mobile menu), ui (tables, filters, confirm buttons)
  components/AccountDisabled.jsx   shown to deactivated accounts
  lib/orderFlow.js          the combined 7-stage order flow used by the admin
  lib/config.js             runtime settings (/env-config.js or .env), refuses secret keys
  lib/geo.js                GPS, coordinates, Google Maps navigation links
  lib/useLiveCart.js        cart with live prices / availability from the database
  components/map/           LocationMap (Leaflet, lazy-loaded), DeliveryLocation (address, lat/lng, map, Navigate)
    user/Checkout.jsx       GPS location + delivery details + Place Order
    ForgotPassword.jsx, ResetPassword.jsx
api/
  env-config.js             Vercel function: turns env vars into /env-config.js (public values only)
public/
  vendor/leaflet/           Leaflet stylesheet + images
dist/                       ready static production build served by Vercel
vercel.json                 static hosting: no build, SPA rewrites, security + cache headers
supabase/
  migrations/0001_profiles.sql
  migrations/0002_customer.sql
  migrations/0003_shop.sql
  migrations/0004_delivery_statuses.sql   run on its own
  migrations/0005_delivery.sql
  migrations/0006_admin.sql
  migrations/0007_integrity.sql
  migrations/0008_production.sql
  seed/demo_shops.sql       optional demo shops (no orders)
```
