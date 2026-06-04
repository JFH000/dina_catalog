export interface Profile {
  id: string
  full_name: string | null
  whatsapp_number: string | null
}

export interface Catalog {
  id: string
  owner_id: string
  name: string
  slug: string
  whatsapp_number: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  catalog_id: string
  reference: string
  name: string
  measurements: string
  quality: string
  image_url: string | null
  is_active: boolean
  created_at: string
}

export interface OrderItem {
  product_id: string
  quantity: number
}

export interface Order {
  catalog_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  items: OrderItem[]
}

export interface CartItem {
  product: Product
  quantity: number
}
