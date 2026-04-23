import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PublicLayout from '../../components/PublicLayout'

type Product = {
  id: string
  name: string
  price: number
  category: 'bebida' | 'comida' | 'otro'
}

const CATEGORY_LABELS: Record<string, string> = {
  bebida: 'Bebidas',
  comida: 'Comidas',
  otro: 'Otros',
}

const CATEGORY_ORDER = ['bebida', 'comida', 'otro']

function formatPrice(n: number): string {
  return `$${n.toLocaleString('es-AR')}`
}

export default function Carta() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, price, category')
      .order('name')
      .then(({ data }) => {
        if (data) setProducts(data as Product[])
        setLoading(false)
      })
  }, [])

  const grouped = CATEGORY_ORDER.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = products.filter(p => p.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col pb-12">
        <div className="px-5 -mt-2 mb-4">
          <button
            onClick={() => navigate('/')}
            className="text-white/40 hover:text-white/70 transition-colors text-2xl leading-none"
          >
            ←
          </button>
        </div>

        <p className="text-center text-gray-300 text-sm font-semibold uppercase tracking-[0.25em] mb-8">
          Carta digital
        </p>

        <div className="px-4 space-y-10">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/10" />
                <h2 className="text-white/60 text-xs uppercase tracking-[0.2em] font-bold">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-3">
                {items.map(product => (
                  <div
                    key={product.id}
                    className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-5 flex items-center justify-between"
                  >
                    <p className="text-white font-semibold text-base">{product.name}</p>
                    <p className="text-emerald-400 text-xl font-bold">{formatPrice(product.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 text-sm">No hay productos disponibles</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
