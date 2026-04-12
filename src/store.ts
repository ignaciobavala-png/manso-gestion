export interface Product {
  id: string
  name: string
  stock: number
  price: number
  category: 'bebida' | 'comida' | 'otro'
}

export interface Guest {
  id: string
  name: string
  timestamp: string
  type: 'invitado' | 'regular'
}

export interface Sale {
  id: string
  productId: string
  productName: string
  quantity: number
  total: number
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia'
  timestamp: string
}

export interface TicketSale {
  id: string
  guestName: string
  type: 'regular' | 'invitado'
  price: number
  timestamp: string
}



export const useStore = {
  balance: 0,
  ticketPrices: {
    regular: 0,
    invitado: 0
  },
  products: [],
  guests: [],
  sales: [],
  ticketSales: [],
  setStockInicial: (productId: string, stock: number) => {
    console.log(`Setting stock for product ${productId} to ${stock}`)
  },
  addGuest: (guest: Omit<Guest, 'id' | 'timestamp'>) => {
    console.log('Adding guest:', guest)
  },
  updateBalance: (amount: number) => {
    console.log(`Updating balance by ${amount}`)
  },
  sellProduct: (productId: string, quantity: number) => {
    console.log(`Selling ${quantity} of product ${productId}`)
  },
  addSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => {
    console.log('Adding sale:', sale)
  },
  addTicketSale: (ticketSale: Omit<TicketSale, 'id' | 'timestamp'>) => {
    const newTicketSale: TicketSale = {
      ...ticketSale,
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString('es-AR'),
    }
    useStore.ticketSales.push(newTicketSale)
    console.log('Adding ticket sale:', newTicketSale)
  },
  addProduct: (product: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...product,
      id: Date.now().toString(),
    }
    useStore.products.push(newProduct)
    console.log('Adding product:', newProduct)
  },
}