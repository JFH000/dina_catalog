import type { CartItem } from '../types'

interface CustomerInfo {
  name?: string
  email?: string
  phone?: string
}

export function buildWhatsAppMessage(
  catalogName: string,
  items: CartItem[],
  customer: CustomerInfo
): string {
  const lines: string[] = [`Hola! Mi pedido del catálogo ${catalogName}:`]
  for (const { product, quantity } of items) {
    lines.push(`- [${product.reference}] ${product.name} x${quantity}`)
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
