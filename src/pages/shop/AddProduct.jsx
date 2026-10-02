import { useNavigate } from 'react-router-dom'
import { useMyShop } from '../../context/MyShopContext'
import { RequireShop } from '../../components/shop/ShopLayout'
import ProductForm from '../../components/shop/ProductForm'
import { PageHeader } from '../../components/user/ui'

function AddProductForm() {
  const { shop } = useMyShop()
  const navigate = useNavigate()
  return (
    <div className="container user-content narrow-page">
      <PageHeader title="Add product" back={{ to: '/shop/products', label: 'Products' }} />
      <section className="card">
        <ProductForm
          shopId={shop.id}
          product={null}
          onCancel={() => navigate('/shop/products')}
          onSaved={(p) => navigate('/shop/products', { state: { notice: `“${p.name}” was added.` } })}
        />
      </section>
    </div>
  )
}

// Add Product — /shop/products/add
export default function AddProduct() {
  return (
    <RequireShop>
      <AddProductForm />
    </RequireShop>
  )
}
