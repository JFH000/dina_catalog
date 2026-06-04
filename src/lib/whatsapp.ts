import type { CartItem, Product } from '../types'

interface CustomerInfo {
  name?: string
  email?: string
  phone?: string
}

const BLANK = /^[-–—/\\.\s]*(n\/?a|none|nan|null|–|—|-)?[-–—/\\.\s]*$/i
function vis(val: string | null | undefined): string | null {
  if (val == null) return null
  const s = val.trim()
  return s && !BLANK.test(s) ? s : null
}

export function productLabel(product: Pick<Product, 'reference' | 'name'>): string {
  const ref = vis(product.reference)
  const name = vis(product.name)
  if (ref && name) return `[${ref}] ${name}`
  if (ref) return `[${ref}]`
  if (name) return name
  return '—'
}

export function buildWhatsAppMessage(
  catalogName: string,
  items: CartItem[],
  customer: CustomerInfo
): string {
  const lines: string[] = [`Hola! Mi pedido del catálogo ${catalogName}:`]
  for (const { product, quantity } of items) {
    lines.push(`- ${productLabel(product)} x${quantity}`)
  }
  if (customer.name) lines.push(`\nNombre: ${customer.name}`)
  if (customer.email) lines.push(`Correo: ${customer.email}`)
  if (customer.phone) lines.push(`Tel: ${customer.phone}`)
  return lines.join('\n')
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}
