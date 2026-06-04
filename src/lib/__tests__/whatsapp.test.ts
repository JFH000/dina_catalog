import { describe, it, expect } from 'vitest'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../whatsapp'
import type { CartItem } from '../../types'

const makeProduct = (ref: string, name: string) => ({
  id: '1',
  catalog_id: 'cat1',
  reference: ref,
  name,
  measurements: '10x20',
  quality: 'Alta',
  image_url: null,
  created_at: '',
  is_active: true,
})

describe('buildWhatsAppMessage', () => {
  it('includes catalog name in greeting', () => {
    const msg = buildWhatsAppMessage('Verano 2025', [], {})
    expect(msg).toContain('Verano 2025')
  })

  it('lists each product with reference and quantity', () => {
    const items: CartItem[] = [
      { product: makeProduct('REF01', 'Camisa'), quantity: 2 },
      { product: makeProduct('REF02', 'Pantalón'), quantity: 1 },
    ]
    const msg = buildWhatsAppMessage('Test', items, {})
    expect(msg).toContain('[REF01] Camisa x2')
    expect(msg).toContain('[REF02] Pantalón x1')
  })

  it('includes customer name when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { name: 'Juan' })
    expect(msg).toContain('Nombre: Juan')
  })

  it('includes customer email when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { email: 'a@b.com' })
    expect(msg).toContain('Correo: a@b.com')
  })

  it('includes customer phone when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { phone: '123456' })
    expect(msg).toContain('Tel: 123456')
  })

  it('omits customer fields when not provided', () => {
    const msg = buildWhatsAppMessage('Test', [], {})
    expect(msg).not.toContain('Nombre:')
    expect(msg).not.toContain('Correo:')
    expect(msg).not.toContain('Tel:')
  })
})

describe('buildWhatsAppUrl', () => {
  it('strips non-digits from phone number', () => {
    const url = buildWhatsAppUrl('+57 300 123-4567', 'hola')
    expect(url).toContain('573001234567')
  })

  it('URL-encodes the message', () => {
    const url = buildWhatsAppUrl('123', 'hola mundo')
    expect(url).toContain(encodeURIComponent('hola mundo'))
  })

  it('returns a wa.me URL', () => {
    const url = buildWhatsAppUrl('123', 'test')
    expect(url).toMatch(/^https:\/\/wa\.me\//)
  })
})
