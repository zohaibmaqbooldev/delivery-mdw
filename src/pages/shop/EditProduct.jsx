import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import ProductForm from '../../components/shop/ProductForm'
import { isUuid } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/user/ui'

function EditProductForm() {
  const { id } = useParams()
  const { shop } = useMyShop()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', product: null })

  useEffect(() => {
    let active = true
    if (!isUuid(id)) {
      setState({ loading: false, error: '', product: null })
      return
    }
    supabase
      .from('products')
      .select('id, shop_id, category_id, name, description, price, image_url, is_available')
      .eq('id', id)
      .eq('shop_id', shop.id) // only this shop's products
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) setState({ loading: false, error: error ? error.message : '', product: data })
      })
    return () => {
      active = false
    }
  }, [id, shop.id])

  const { loading, error, product } = state

  return (
    <div className="container user-content narrow-page">
      <PageHeader title="Edit product" back={{ to: '/shop/products', label: 'Products' }} />
      {loading ? (
        <Skeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : !product ? (
        <EmptyState
          title="Product not found"
          text="This product doesn't exist or belongs to another shop."
          action={
            <Link to="/shop/products" className="btn btn-primary">
              Back to products
            </Link>
          }
        />
      ) : (
        <section className="card">
          <ProductForm
            shopId={shop.id}
            product={product}
            onCancel={() => navigate('/shop/products')}
            onSaved={(p) => navigate('/shop/products', { state: { notice: `“${p.name}” was saved.` } })}
          />
        </section>
      )}
    </div>
  )
}

// Edit Product — /shop/products/:id/edit
export default function EditProduct() {
  return (
    <RequireShop>
      <EditProductForm />
    </RequireShop>
  )
}
